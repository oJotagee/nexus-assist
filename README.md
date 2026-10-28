# Nexo Assist

Agent de atendimento para o service desk de TI da Nexo: o funcionário descreve o problema num chat e o agent decide se responde uma dúvida, consulta ou complementa um chamado, abre um chamado novo ou chama um analista.

- Desafio e PRD: [`docs/PRD.md`](docs/PRD.md) · protótipo em [`docs/prototype/`](docs/prototype) · design system em [`design-system/MASTER.md`](design-system/MASTER.md)

> README em construção: arquitetura detalhada, como o agent decide, qualidade das decisões e trade-offs entram no marco M7 do PRD.

## Estrutura

```
frontend/          Next.js 16 (App Router) — chat do funcionário, perfil, login       :3000
services/assist/   NestJS + Mastra — login, conversas, agent, rascunhos, console      :8081
services/tickets/  NestJS — sistema de chamados legado simulado (instável de propósito) :8082
packages/shared/   regras do Anexo A (prioridade, prazo em horas úteis), contratos da API
```

O frontend fala só com o assist. O serviço de chamados fica na rede interna (`X-Internal-Secret`).

## Como rodar

Pré-requisitos: [Bun 1.4+](https://bun.sh) e Docker.

```bash
bun install

# variáveis de ambiente (os valores padrão funcionam localmente)
cp services/tickets/.env.example services/tickets/.env
cp services/assist/.env.example  services/assist/.env     # coloque sua ANTHROPIC_API_KEY
cp frontend/.env.example         frontend/.env

bun run docker:dev:up   # Postgres com os bancos nexo_assist e nexo_tickets
bun run db:setup        # migrations + dados de exemplo (Anexo B)

# em três terminais
bun run dev:tickets
bun run dev:assist
bun run dev:frontend    # http://localhost:3000
```

Contas de exemplo (qualquer senha): `ana.souza@nexo.com.br`, `fabio.nunes@nexo.com.br` (funcionários) e `rafael.lima@nexo.com.br` (analista N2). A tela de login tem atalhos para elas.

Sem `ANTHROPIC_API_KEY` tudo funciona, menos as respostas do agent: o chat avisa que o assistente está indisponível.

## Testes

```bash
bun run test:unit                 # regras, domínio, casos de uso, agent com modelo roteirizado, parser SSE
bun run test:integration:tickets  # serviço de chamados contra o Postgres
bun run eval                      # evals do agent com o modelo real (custa tokens; exige ANTHROPIC_API_KEY)
bun run test:smoke                # ponta a ponta contra o app rodando (frontend + assist + tickets)
bun run typecheck && bun run lint
```

## Modelo

Padrão `claude-opus-5-5` (`AGENT_MODEL` em `services/assist/.env`), com esforço `low` para respostas de chat, cache de prompt no prompt de sistema + tools e fallback de recusa no servidor. Para reduzir o custo por conversa, `claude-haiku-5-5`; compare a qualidade antes com `bun run eval --model claude-haiku-5-5`.
