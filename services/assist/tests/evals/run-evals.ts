/**
 * Evals do agent com o modelo real:
 *   bun run eval                              # provedor e modelo do .env (Gemini grátis por padrão)
 *   bun run eval --model gemini-2.5-flash     # compara outro modelo do mesmo provedor
 *   bun run eval --provider anthropic         # usa a Anthropic (ANTHROPIC_API_KEY)
 *   bun run eval --only faq-horario,critico-empresa
 *   bun run eval --report                 # grava tests/evals/reports/<data>-<modelo>.md
 *
 * Cada cenário roda o NexoAgentRunner completo (Mastra + tools + regras em código) contra um
 * sistema de chamados em memória com os dados do Anexo B, e é pontuado de forma objetiva
 * (score.ts, que tem testes próprios). Consome cota do provedor: não roda no `bun test`.
 * No plano gratuito do Gemini, cada cenário faz 2 a 4 chamadas ao modelo; use --only para rodar
 * em partes se a cota diária for baixa.
 */
import { config } from 'dotenv';

config({ path: `${import.meta.dir}/../../.env` });

import { mkdir, writeFile } from 'node:fs/promises';
import type { MessageBlock, TraceStep } from '@nexo/shared';

import { ConversationEntity } from '@/domain/entities/conversation.entity';
import { evaluateHandoff } from '@/domain/policies/handoff-policy';
import { agentModelEnv, createAgentModel } from '@/infrastructure/agent/model';
import { NexoAgentRunner } from '@/infrastructure/agent/nexo-agent.runner';
import { NOW, at, buildTicket, createRepositories } from '../unit/support/in-memory';
import { type EvalScenario, SCENARIOS } from './scenarios';
import { CRITERIA, type ScenarioRun, scoreScenario, summarizeByCriterion } from './score';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const only = flag('--only')?.split(',');
const writeReport = args.includes('--report');

/** US$ por milhão de tokens (entrada, saída). Modelos fora da tabela (Gemini no plano gratuito) custam 0. */
const PRICE_PER_MTOK: Record<string, [number, number]> = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
};

const ARTICLES = [
  {
    id: 'kb-vpn-809',
    title: 'VPN com erro 809',
    body: 'Reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado.',
    category: 'NETWORK_VPN',
    tags: ['vpn', 'erro 809', 'windows 10'],
  },
  {
    id: 'kb-horario',
    title: 'Horário do service desk',
    body: 'De segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.',
    category: 'OTHER',
    tags: ['horário', 'atendimento', 'plantão'],
  },
  {
    id: 'kb-senha-rede',
    title: 'Troca de senha da rede',
    body: 'A senha da rede expira a cada 90 dias. Troque pelo portal de autoatendimento com o código enviado ao celular cadastrado.',
    category: 'ACCESS',
    tags: ['senha', 'rede', 'expirada'],
  },
  {
    id: 'kb-sap-desbloqueio',
    title: 'Desbloqueio de senha do SAP',
    body: 'Use o autoatendimento do SAP com o código do celular. Se o desbloqueio falhar 3 vezes, abra um chamado de Acesso.',
    category: 'ACCESS',
    tags: ['sap', 'senha bloqueada'],
  },
  {
    id: 'kb-wifi',
    title: 'Wi-Fi corporativo Nexo-Corp',
    body: 'Conecte na rede Nexo-Corp com usuário e senha da rede. Se pedir certificado, aceite o "Nexo Root CA". Para reconectar, esqueça a rede e conecte de novo.',
    category: 'NETWORK_VPN',
    tags: ['wi-fi', 'wifi', 'certificado'],
  },
  {
    id: 'kb-outlook-celular',
    title: 'Outlook não sincroniza no celular',
    body: 'Remova a conta do app Outlook e adicione de novo com o e-mail corporativo.',
    category: 'EMAIL',
    tags: ['outlook', 'celular'],
  },
  {
    id: 'kb-notebook-lento',
    title: 'Notebook lento depois de atualização',
    body: 'Reinicie, rode o Windows Update até o fim e libere espaço em disco. Se continuar lento, abra um chamado de Hardware.',
    category: 'HARDWARE',
    tags: ['lento', 'atualização', 'notebook'],
  },
  {
    id: 'kb-pedido-software',
    title: 'Como pedir um software',
    body: 'Abra uma requisição com o nome do software e a justificativa. Softwares pagos precisam da aprovação do gestor.',
    category: 'SOFTWARE',
    tags: ['software', 'licença', 'instalação'],
  },
];

/** Chamados do Anexo B como o legado devolveria em 27/10/2026, 10h. */
function seedTickets(repos: ReturnType<typeof createRepositories>): void {
  repos.tickets.tickets.push(
    buildTicket(),
    buildTicket({
      id: 'INC-20299',
      title: 'Acesso à pasta Financeiro no SharePoint',
      description: 'Sem permissão para a pasta Financeiro/Fechamento.',
      category: 'ACCESS',
      status: 'IN_PROGRESS',
      lastUpdateAt: at('2026-10-26T10:00:00'),
      deadline: { dueAt: at('2026-10-29T10:00:00'), overdue: false, slaLabel: '3 dias úteis' },
    }),
    buildTicket({
      id: 'REQ-10442',
      type: 'REQ',
      title: 'Segundo monitor para home office',
      description: 'Monitor de 24" para home office.',
      priority: 'LOW',
      status: 'APPROVED',
      lastUpdateAt: at('2026-10-22T10:00:00'),
      deadline: { dueAt: at('2026-10-29T10:00:00'), overdue: false, slaLabel: '5 dias úteis' },
    }),
    buildTicket({
      id: 'INC-20150',
      title: 'Senha do SAP bloqueada',
      description: 'Senha do SAP bloqueada após tentativas erradas.',
      category: 'ACCESS',
      status: 'RESOLVED',
      resolvedAt: at('2026-10-23T10:00:00'),
      canReopen: true,
      deadline: { dueAt: null, overdue: false, slaLabel: '3 dias úteis' },
    }),
    buildTicket({
      id: 'INC-20321',
      requesterId: 'emp_bruno',
      title: 'VPN caindo durante reuniões',
      category: 'NETWORK_VPN',
    }),
  );
}

async function runScenario(
  scenario: EvalScenario,
  model: NonNullable<ReturnType<typeof createAgentModel>>,
  prices: [number, number],
): Promise<ScenarioRun> {
  const repos = createRepositories();
  repos.articles.articles.push(...ARTICLES);
  seedTickets(repos);
  await repos.conversations.create(
    ConversationEntity.start({ id: 'c1', employeeId: 'emp_ana' }, NOW),
  );

  const runner = new NexoAgentRunner(model, repos.tickets, repos.drafts, repos.articles, repos.ids);
  const silent = {
    step: (_: TraceStep) => {},
    textDelta: (_: string) => {},
    block: (_: MessageBlock) => {},
  };

  const result = await runner.run(
    {
      employee: { id: 'emp_ana', name: 'Ana Souza', department: 'Financeiro' },
      conversationId: 'c1',
      now: NOW,
      history: scenario.history ?? [],
      userMessage: scenario.userMessage,
      sessionSummary: null,
      focusTicketId: scenario.focusTicketId ?? null,
      pendingDraft: scenario.pendingDraft ?? null,
    },
    silent,
  );

  const handoff = evaluateHandoff({
    intent: result.decision.intent,
    confidenceBand: result.decision.confidence.band,
    requested: result.handoffRequest,
    draftPriority: result.draft?.priority ?? null,
    previousWasLowConfidenceClarify: false,
  });

  return {
    scenario,
    score: scoreScenario(scenario, result, handoff?.reason ?? null),
    costUsd:
      (result.usage.inputTokens * prices[0] + result.usage.outputTokens * prices[1]) / 1_000_000,
    latencyMs: result.usage.latencyMs,
    declaredByModel: result.decision.declaredByModel,
  };
}

function renderReport(modelId: string, runs: ScenarioRun[]): string {
  const passed = runs.filter((run) => run.score?.passed).length;
  const byCriterion = summarizeByCriterion(runs);
  const cost = runs.reduce((sum, run) => sum + run.costUsd, 0);
  const latency = runs.reduce((sum, run) => sum + run.latencyMs, 0);

  const lines = [
    `# Evals do agent — ${modelId}`,
    '',
    `Executado em ${new Date().toISOString()} · ${runs.length} cenários · acerto **${passed}/${runs.length}** (${Math.round((passed / runs.length) * 100)}%)`,
    '',
    `Custo médio por turno: US$ ${(cost / runs.length).toFixed(5)} · latência média: ${Math.round(latency / runs.length)} ms · decisão não registrada pelo modelo: ${runs.filter((run) => !run.declaredByModel).length}`,
    '',
    '## Por critério',
    '',
    '| Critério | Acerto |',
    '|---|---|',
    ...CRITERIA.map(
      (criterion) =>
        `| ${criterion} | ${byCriterion[criterion].passed}/${byCriterion[criterion].total} |`,
    ),
    '',
    '## Cenários',
    '',
    '| Cenário | Resultado | Falhas |',
    '|---|---|---|',
    ...runs.map((run) => {
      const status = run.error ? 'erro' : run.score?.passed ? 'ok' : 'falhou';
      const failures =
        run.error ??
        run.score?.failures
          .map((failure) => `${failure.criterion}: ${failure.detail}`)
          .join('; ') ??
        '';
      return `| ${run.scenario.id} — ${run.scenario.description} | ${status} | ${failures} |`;
    }),
  ];

  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const env = agentModelEnv();
  const model = createAgentModel({
    ...env,
    provider: flag('--provider') ?? env.provider,
    modelId: flag('--model') ?? (flag('--provider') ? undefined : env.modelId),
  });
  if (!model) {
    console.log(
      'Chave do provedor não configurada em services/assist/.env (GOOGLE_GENERATIVE_AI_API_KEY ou ANTHROPIC_API_KEY) — evals não executados.',
    );
    return;
  }

  const scenarios = SCENARIOS.filter((scenario) => !only || only.includes(scenario.id));
  const prices = PRICE_PER_MTOK[model.id] ?? [0, 0];
  const runs: ScenarioRun[] = [];

  console.log(`Modelo: ${model.id} · ${scenarios.length} cenários\n`);

  for (const scenario of scenarios) {
    try {
      const run = await runScenario(scenario, model, prices);
      runs.push(run);
      const failures =
        run.score?.failures.map((failure) => `${failure.criterion}: ${failure.detail}`) ?? [];
      console.log(
        `${run.score?.passed ? '✓' : '✗'} ${scenario.id.padEnd(28)} ${String(run.latencyMs).padStart(6)} ms  US$ ${run.costUsd.toFixed(5)}${failures.length ? `\n    ${failures.join('\n    ')}` : ''}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runs.push({
        scenario,
        score: null,
        error: message,
        costUsd: 0,
        latencyMs: 0,
        declaredByModel: false,
      });
      console.log(`✗ ${scenario.id.padEnd(28)} erro: ${message}`);
    }
  }

  const report = renderReport(model.id, runs);
  const summary = report.split('\n').slice(2, 5).join('\n');
  console.log(`\n${summary}`);

  if (writeReport) {
    const dir = `${import.meta.dir}/reports`;
    await mkdir(dir, { recursive: true });
    const file = `${dir}/${new Date().toISOString().slice(0, 10)}-${model.id}.md`;
    await writeFile(file, report);
    console.log(`\nRelatório: ${file}`);
  }

  if (runs.some((run) => !run.score?.passed)) process.exitCode = 1;
}

main();
