# Nexo Assist

Agent de atendimento do service desk de TI da Nexo. O funcionário descreve o problema num chat e o agent decide, a cada mensagem, se **responde uma dúvida**, **consulta ou complementa um chamado**, **abre um chamado novo** ou **chama um analista**. Do outro lado, o analista tem um console para assumir conversas, com o agent pausado, e devolvê-las ou encerrá-las.

Construído a partir do PRD do desafio da Beyond the Bytes e das telas do protótipo (Anexo C).

## Como rodar

Pré-requisitos: [Bun 1.4+](https://bun.sh) e Docker.

```bash
bun install
bun run setup   # cria os .env, sobe o Postgres, aplica migrations e carrega os dados de exemplo
bun run dev     # tickets :8082 · assist :8081 · frontend http://localhost:3000
```

Para as respostas do agent, gere uma **chave gratuita** do Gemini em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (conta Google, sem cartão) e coloque em `GOOGLE_GENERATIVE_AI_API_KEY` no arquivo `services/assist/.env`. Sem ela, todo o resto funciona (login, histórico, console, rascunhos) e o chat avisa que o assistente está indisponível.

**Contas de exemplo** (qualquer senha; a tela de login tem atalhos):

| Conta | Papel | O que dá para ver |
|---|---|---|
| `ana.souza@nexo.com.br` | funcionária | conversa já transferida para o N2 (chamado vencido) |
| `fabio.nunes@nexo.com.br` | funcionário | chat com o agent ativo |
| `rafael.lima@nexo.com.br` | analista N2 | console com a fila de conversas |

## Deploy (Railway + Vercel)

Os dois serviços e o Postgres ficam no Railway; o frontend na Vercel. O serviço de chamados não tem domínio público: só o assist fala com ele, pela rede privada do Railway.

**Railway** (um projeto com dois Postgres e dois serviços apontando para este repositório, com o diretório raiz vazio):

| Serviço | Dockerfile | Domínio público | Variáveis |
|---|---|---|---|
| `postgres-tickets` e `postgres-assist` | — | não | — |
| `tickets` | `services/tickets/Dockerfile` | não | `DATABASE_URL=${{postgres-tickets.DATABASE_URL}}`, `INTERNAL_API_SECRET` |
| `assist` | `services/assist/Dockerfile` | sim (porta 8081) | `DATABASE_URL=${{postgres-assist.DATABASE_URL}}`, `JWT_SECRET`, `INTERNAL_API_SECRET` (o mesmo), `TICKETS_API_URL=http://tickets.railway.internal:8082`, `GOOGLE_GENERATIVE_AI_API_KEY` |

O Dockerfile de cada serviço é escolhido pela variável `RAILWAY_DOCKERFILE_PATH`. No start, cada um aplica as migrations pendentes; os dados de exemplo são carregados à parte, da sua máquina:

1. Em cada Postgres do Railway, habilite o acesso público e copie a `DATABASE_PUBLIC_URL`.
2. Crie `services/tickets/.env.production` e `services/assist/.env.production` (fora do git) com `DATABASE_URL="<DATABASE_PUBLIC_URL>"`.
3. Rode `bun run db:prod:seed` (só popula banco vazio). `bun run db:prod:reset` apaga e recarrega, com confirmação; `bun run db:prod:migrate` aplica migrations.

**Vercel**: importe o repositório com o diretório raiz `frontend` e defina `ASSIST_API_URL` (domínio público do assist), `AUTH_SECRET` e `AUTH_TRUST_HOST=true`.

## Arquitetura

```
 navegador
    │  HTTPS (cookie de sessão; o token do assist nunca chega ao navegador)
    ▼
 frontend/  Next.js 16 ─ _actions / _data-access ('use server' + axios), React Query, TanStack Table
    │  REST + SSE (Bearer JWT)
    ▼
 services/assist/  NestJS + Mastra ─ login, conversas, agent, rascunhos, console, traces
    │  REST interno (X-Internal-Secret + Idempotency-Key)
    ▼
 services/tickets/  NestJS ─ "sistema legado" de chamados, instável de propósito

 packages/shared/  regras do Anexo A (prioridade, prazo em horas úteis) e contratos da API
 Postgres: um banco por serviço (nexo_assist, nexo_tickets)
```

- **Separação:** a interface só fala com o assist. O agent (`services/assist/src/infrastructure/agent`) é um adaptador atrás de um port (`AgentRunner`). O sistema de chamados é um serviço à parte, que o agent só alcança por um cliente HTTP (`TicketsGateway`). Os serviços seguem camadas (domain, application, infrastructure, presentation), como no projeto de referência do time.
- **Por que dois serviços e não um:** o desafio pede o serviço de chamados separado do agent, e ele precisa se comportar como um legado (fora do nosso controle, instável). Login, conversas e central de ajuda ficam juntos no assist porque mudam juntos.
- **Persistência:** conversas, mensagens, estado (com o agent ou com um analista), rascunhos, traces e chamados ficam no Postgres e sobrevivem a reinícios (testado com restart do container). O seed tem o modo `SEED_IF_EMPTY`, para o container não apagar dados ao subir de novo.
- **Tempo real:** a resposta do agent chega por SSE (passos, texto token a token, cards). Um route handler do Next faz o proxy, porque server actions não fazem streaming. O console e o chat com analista atualizam por polling de 4 s.

## Como o agent decide o que fazer

Cada mensagem passa por `SendMessageUseCase` (`services/assist/src/application/use-cases/conversation/send-message.use-case.ts`):

1. **Gates em código:** a conversa é do funcionário? Cabe na sessão (limite de 30 mensagens)? Está dentro do orçamento diário de tokens? Se a conversa está com um analista ou esperando um, **a mensagem é só gravada e o agent não é chamado**.
2. **Agent Mastra com tools tipadas (Zod)**, criadas por turno com o funcionário autenticado em closure. O `employeeId` nunca vem dos argumentos do modelo, então o agent não consegue ver chamados de outra pessoa nem se for induzido.

   | Tool | Para quê |
   |---|---|
   | `search_help_center` | dúvidas e checar se há solução documentada antes de abrir chamado |
   | `list_my_tickets` / `get_my_ticket` | status, prazo e vencimento; o detalhe já mostra o card |
   | `show_ticket_picker` / `ask_quick_question` | perguntar o que falta, com opções clicáveis |
   | `draft_ticket` | monta o rascunho (**não cria chamado**) |
   | `request_handoff` | transfere para um analista, com resumo |
   | `register_decision` | registra intenção, entendimento, ação, segurança (0–1) e porquê |

3. **Regras do Anexo A aplicadas em código, não no prompt:**
   - **Abertura só com confirmação:** o LLM não tem tool que crie chamado. Só o botão "Confirmar" chama `ConfirmDraftUseCase`, que grava no legado com a idempotency key do rascunho.
   - **Sem duplicidade:** `draft_ticket` compara com os chamados abertos ou resolvidos há até 7 dias, na mesma categoria (`duplicate-detector.ts`), e converte o rascunho em atualização ou reabertura.
   - **Prioridade e prazo:** o modelo só extrai os fatos (impacto, se impede o trabalho, se há compromisso hoje). A matriz e o prazo em horas úteis estão em `packages/shared/src/sla`, e o trace cita a regra usada.
   - **Transferência** (`handoff-policy.ts`): respeita o pedido do agent e força a transferência em caso crítico ou de segurança baixa (< 0,6) numa ação. Numa pergunta de esclarecimento, só força na segunda vez seguida, porque perguntar quando falta informação é a conduta certa. Chamado vencido não transfere sozinho: o agent oferece o analista, como na Tela 3.
4. **Transparência:** cada resposta grava um `DecisionTrace` com o que entendeu, a ação, a segurança, o porquê, as regras aplicadas, os passos (com duração e tentativas no legado) e o custo. Na UI, as ações aparecem acima da resposta ("✓ consultou seus chamados"), e "Por quê?" abre o detalhe, no chat e no console. Se o modelo esquecer de registrar a decisão, ela é inferida dos passos e marcada como inferida.
5. **Legado instável:** o serviço de chamados responde 503 em ~15% das chamadas. O cliente repete com backoff (300/600/1200 ms), inclusive escritas, que são seguras pela idempotency key. Se esgotar, o passo fica "falhou", o agent explica e oferece tentar de novo ou chamar um analista, e o rascunho é mantido.

## Como garanti a qualidade das decisões

| Camada | O que cobre | Comando |
|---|---|---|
| Regras do service desk | horas úteis, matriz de prioridade, prazo, vencimento, reabertura | `bun run test:unit` |
| Domínio e casos de uso | máquina de estados da conversa, rascunho, limite de sessão, privacidade, política de transferência, duplicidade, busca na central | `bun run test:unit` |
| **Agent no loop real do Mastra** | modelo roteirizado chamando as tools de verdade: card, privacidade (chamado alheio), duplicidade, rascunho refeito, transferência, decisão inferida | `bun run test:unit` |
| Integração | serviço de chamados contra o Postgres; **fluxo completo do assist pelo HTTP** com o legado real a 10% de falhas | `bun run test:integration` |
| Interface | rascunho (confirmar, legado instável, descartar), trail e painel "Por quê?", opções rápidas, ações do console | `bun run test:interaction` |
| Ponta a ponta | app rodando: login, áreas por papel, token fora do HTML, chat por SSE, console, rate limit | `bun run test:smoke` |
| **Evals com o modelo real** | 27 cenários do Anexo A com gabarito objetivo: dúvida, VPN 809 Win10 × Win11, status sem número, vencido, reabrir, duplicado, requisição baixa, crítico, fora do escopo, injeção de prompt, chamado alheio, mensagem vaga… Relatório por critério e custo por turno | `bun run eval --report` |

Algumas escolhas deliberadas:

- **A régua dos evals também é testada** (`tests/unit/evals/score.spec.ts`). A pontuação é objetiva (intenção, ferramentas, rascunho, transferência e texto) e sem LLM-juiz, para ser reprodutível.
- **Testes que pegam regressão de verdade:** quebrei a checagem de dono do chamado de propósito e os testes de privacidade falharam.
- **O teste de integração achou um bug real:** dois cliques simultâneos em "Confirmar" criavam dois chamados, porque a idempotency key só era gravada depois da escrita. Agora a chave é reservada antes. A segunda requisição espera e repete a resposta da primeira, e o rascunho é confirmado com update condicional.
- **Status dos evals:** a suíte está pronta, mas não rodou contra o modelo real no desenvolvimento por falta de chave. Para medir, configure a chave gratuita do Gemini e rode `bun run eval --report` (com `--only` para rodar em partes se a cota diária do plano gratuito acabar). O relatório vai para `services/assist/tests/evals/reports/`.

## Segurança e privacidade

- Chaves só em `.env` (há `.env.example` de cada serviço). O token do assist fica no cookie de sessão do Auth.js e só o servidor Next o lê.
- Chamados sempre escopados pelo funcionário, no assist e no legado. Um chamado de outra pessoa responde "não encontrado", sem confirmar que existe.
- Papéis separados: o funcionário não entra no console (o proxy do Next e um guard no assist bloqueiam).
- Rate limit: 12 mensagens/min ao agent por funcionário, limite geral por usuário e 10 logins/min por IP. Há também um orçamento diário de tokens por funcionário.
- O serviço de chamados não é exposto: rotas `/internal/*` com segredo compartilhado (comparação em tempo constante).

## Modelo e custo

- **Padrão: `gemini-3.5-flash-lite` no plano gratuito do Google AI Studio.** Custo zero e sem cartão, com function calling (que o Mastra usa para as tools) e raciocínio em nível `low`. Foi escolhido medindo com uma chave gratuita:

  | Modelo | Resposta | Limite gratuito |
  |---|---|---|
  | `gemini-3.5-flash-lite` | ~0,7 s | 15 requisições/min |
  | `gemini-3.6-flash` | ~1,7 s | 5 requisições/min (estoura com 1 a 2 mensagens por minuto) |
  | `gemini-3.8-flash` | travou > 40 s | — |

  Cada mensagem do funcionário usa de 2 a 4 requisições ao modelo (ferramentas + resposta), então o flash-lite atende algumas mensagens por minuto.
- **Tempo máximo por turno:** se o modelo não responder em 45 s (`AGENT_TURN_TIMEOUT_MS`), o chat mostra "o assistente demorou demais" com "Tentar novamente", em vez de ficar carregando. O SDK repete uma vez só, para um limite estourado aparecer logo em vez de prender o chat.
- **Limites do plano gratuito:** a cota por minuto e por dia é baixa e varia por projeto (veja em [aistudio.google.com/rate-limit](https://aistudio.google.com/rate-limit)). Quando estoura (429), o chat avisa "o assistente atingiu o limite de uso do momento" e sugere tentar em um minuto ou falar com um analista. O rate limit e o orçamento diário de tokens do assist ajudam a não gastar a cota à toa.
- **Privacidade no plano gratuito:** o Google pode usar os dados do plano gratuito para melhorar os produtos dele. Aqui os dados são fictícios; num uso real com dados de funcionários, o caminho é o plano pago do Gemini ou outro provedor com retenção controlada.
- **Trocar de provedor é configuração:** `AGENT_PROVIDER=anthropic` com `ANTHROPIC_API_KEY` usa a Anthropic (pago; padrão `claude-opus-5-5`, com esforço baixo e fallback de recusa). O agent, as tools e as regras não mudam.
- **Uso consciente:** prompt de sistema e tools estáveis em cache de prompt (o contexto variável vai numa mensagem separada), janela de 16 mensagens + resumo da sessão anterior, teto de 6 passos por turno, prioridade e duplicidade calculadas em código (sem gastar tokens) e tokens por turno registrados no trace.

## Principais trade-offs

| Decisão | Por quê | Custo da escolha |
|---|---|---|
| Criação de chamado fora do LLM (rascunho + botão) | a regra "só cria depois de confirmar" não depende do modelo obedecer | uma interação a mais para o funcionário |
| Prioridade, prazo e duplicidade em código | auditável e testável; o trace cita a regra exata | casos fora da matriz dependem do modelo extrair bem os fatos |
| Decisão estruturada via tool (`register_decision`) | uma chamada só, sem segundo turno de LLM | o modelo pode esquecer; mitigado com inferência marcada |
| Busca por palavras-chave com pesos na central | 8 artigos, previsível e grátis | não escala para centenas de artigos (aí entram embeddings) |
| Polling de 4 s no console | simples e robusto | latência de até 4 s para o analista ver mensagens novas |
| Postgres + Prisma, NestJS em camadas | padrão do time, persistência real | mais cerimônia que um SQLite único |
| Gemini Flash no plano gratuito | custo zero, sem cartão, function calling e limite de tokens por minuto suficiente | cota diária baixa e dados podem ser usados pelo Google; para produção, plano pago ou outro provedor |
| Mastra com providers do AI SDK (`@ai-sdk/google`, `@ai-sdk/anthropic`) | o desafio prefere Mastra; trocar de provedor é só configuração | depende dos providers acompanharem as novidades das APIs |

## O que eu faria com mais tempo

- Rodar e acompanhar os evals em cada mudança de prompt (CI com orçamento), comparar Opus e Haiku e aumentar a base de cenários a partir de conversas reais anonimizadas.
- Eventos em tempo real para o console (SSE/WebSocket) e notificação ao funcionário quando o analista responde.
- Busca semântica na central de ajuda e sugestão de artigos novos a partir de chamados repetidos.
- E2E em navegador (Playwright) cobrindo o fluxo visual; hoje o ponta a ponta é por HTTP.
- SSO corporativo no lugar do login de demonstração, auditoria de acesso dos analistas e retenção configurável das conversas.

## Estrutura

```
frontend/          Next.js — (public)/login · (employee)/atendimento, perfil · (analyst)/console
services/assist/   src/{domain, application, infrastructure/agent, presentation} · tests/{unit, integration, evals}
services/tickets/  src/{domain, application, infrastructure, presentation} · tests/{unit, integration}
packages/shared/   tickets, sla, assist (contratos), seed (funcionários)
scripts/           setup.ts, dev.ts
```

## CI

A cada push na `main` e em pull requests, o GitHub Actions (`.github/workflows/ci.yml`) roda lint, typecheck, os testes unitários e os de interação do frontend. Os testes de integração precisam de Postgres e rodam localmente (`bun run test:integration`).

O deploy só acontece com o CI verde: na Vercel, o deploy automático da `main` fica desligado (`frontend/vercel.json`) e o CI dispara um Deploy Hook (secret `VERCEL_DEPLOY_HOOK_URL`) depois dos testes; no Railway, cada serviço usa a opção "Wait for CI".

## Comandos úteis

```bash
bun run typecheck && bun run lint
bun run test:unit && bun run test:interaction
bun run test:integration      # precisa do Postgres (bun run setup)
bun run test:smoke            # precisa do app rodando (bun run dev)
bun run eval --report         # precisa de GOOGLE_GENERATIVE_AI_API_KEY (gratuita)
bun run db:seed               # restaura os dados de exemplo
```
