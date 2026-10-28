/**
 * Evals do agent com o modelo real: bun run eval [--model claude-haiku-5-5] [--only id1,id2]
 *
 * Cada cenário roda o NexoAgentRunner completo (Mastra + tools + regras em código) contra um
 * sistema de chamados em memória com os dados do Anexo B, e checa objetivamente intenção,
 * tools usadas, rascunho, transferência e texto. Custa tokens: não roda no `bun test`.
 */
import { config } from 'dotenv';

config({ path: `${import.meta.dir}/../../.env` });

import type { MessageBlock, TraceStep } from '@nexo/shared';
import { evaluateHandoff } from '@/domain/policies/handoff-policy';
import { ConversationEntity } from '@/domain/entities/conversation.entity';
import { createAgentModel } from '@/infrastructure/agent/model';
import { NexoAgentRunner } from '@/infrastructure/agent/nexo-agent.runner';
import { NOW, at, buildTicket, createRepositories } from '../unit/support/in-memory';
import { SCENARIOS, type EvalScenario } from './scenarios';

const args = process.argv.slice(2);
const modelArg = args[args.indexOf('--model') + 1];
const only = args.includes('--only') ? args[args.indexOf('--only') + 1]?.split(',') : null;

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

async function runScenario(
  scenario: EvalScenario,
  model: NonNullable<ReturnType<typeof createAgentModel>>,
) {
  const repos = createRepositories();
  repos.articles.articles.push(...ARTICLES);
  repos.tickets.tickets.push(
    buildTicket(),
    buildTicket({
      id: 'INC-20299',
      title: 'Acesso à pasta Financeiro no SharePoint',
      category: 'ACCESS',
      status: 'IN_PROGRESS',
      lastUpdateAt: at('2026-10-26T10:00:00'),
      deadline: { dueAt: at('2026-10-29T10:00:00'), overdue: false, slaLabel: '3 dias úteis' },
    }),
    buildTicket({
      id: 'REQ-10442',
      type: 'REQ',
      title: 'Segundo monitor para home office',
      priority: 'LOW',
      status: 'APPROVED',
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
  await repos.conversations.create(
    ConversationEntity.start({ id: 'c1', employeeId: 'emp_ana' }, NOW),
  );

  const runner = new NexoAgentRunner(model, repos.tickets, repos.drafts, repos.articles, repos.ids);
  const noop = {
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
      focusTicketId: null,
      pendingDraft: null,
    },
    noop,
  );

  const handoff = evaluateHandoff({
    intent: result.decision.intent,
    confidenceBand: result.decision.confidence.band,
    requested: result.handoffRequest,
    draftPriority: result.draft?.priority ?? null,
    previousWasLowConfidenceClarify: false,
  });

  const failures: string[] = [];
  const tools = new Set(result.steps.filter((s) => s.status !== 'FAILED').map((s) => s.tool));
  const e = scenario.expect;
  const intent = handoff ? 'HANDOFF' : result.decision.intent;

  if (e.intent) {
    const allowed = Array.isArray(e.intent) ? e.intent : [e.intent];
    if (!allowed.includes(intent) && !allowed.includes(result.decision.intent))
      failures.push(`intent ${intent} (esperado ${allowed.join('|')})`);
  }
  for (const tool of e.tools ?? []) if (!tools.has(tool)) failures.push(`não usou ${tool}`);
  for (const tool of e.forbiddenTools ?? []) if (tools.has(tool)) failures.push(`usou ${tool}`);
  if (e.draft === null && result.draft) failures.push('montou rascunho indevido');
  if (e.draft) {
    if (!result.draft) failures.push('não montou rascunho');
    else
      for (const [key, value] of Object.entries(e.draft)) {
        const actual = result.draft[key as keyof typeof result.draft];
        if (actual !== value) failures.push(`rascunho.${key}=${actual} (esperado ${value})`);
      }
  }
  if (e.handoff !== undefined && (handoff?.reason ?? null) !== e.handoff)
    failures.push(
      `transferência ${handoff?.reason ?? 'nenhuma'} (esperado ${e.handoff ?? 'nenhuma'})`,
    );
  const blockTypes = result.blocks.map((b) => b.type);
  for (const block of e.blocks ?? [])
    if (!blockTypes.includes(block)) failures.push(`sem bloco ${block}`);
  if (e.blocks && e.blocks.length === 0 && blockTypes.some((t) => t !== 'QUICK_REPLIES'))
    failures.push(`blocos indevidos: ${blockTypes.join(',')}`);
  const text = result.text.toLowerCase();
  for (const piece of e.textIncludes ?? [])
    if (!text.includes(piece.toLowerCase())) failures.push(`texto sem "${piece}"`);
  for (const piece of e.textExcludes ?? [])
    if (text.includes(piece.toLowerCase())) failures.push(`texto com "${piece}"`);

  return { failures, result, declared: result.decision.declaredByModel };
}

async function main(): Promise<void> {
  const model = createAgentModel({
    apiKey: process.env.ANTHROPIC_API_KEY,
    modelId: modelArg ?? process.env.AGENT_MODEL,
  });
  if (!model) {
    console.log(
      'ANTHROPIC_API_KEY não configurada em services/assist/.env — evals não executados.',
    );
    return;
  }

  const scenarios = SCENARIOS.filter((s) => !only || only.includes(s.id));
  const [inPrice, outPrice] = PRICE_PER_MTOK[model.id] ?? [0, 0];
  let passed = 0;
  let cost = 0;
  let latency = 0;
  let undeclared = 0;

  console.log(`Modelo: ${model.id} · ${scenarios.length} cenários\n`);

  for (const scenario of scenarios) {
    try {
      const { failures, result, declared } = await runScenario(scenario, model);
      const turnCost =
        (result.usage.inputTokens * inPrice + result.usage.outputTokens * outPrice) / 1_000_000;
      cost += turnCost;
      latency += result.usage.latencyMs;
      if (!declared) undeclared += 1;
      if (failures.length === 0) passed += 1;

      console.log(
        `${failures.length ? '✗' : '✓'} ${scenario.id.padEnd(26)} ${result.usage.latencyMs}ms  $${turnCost.toFixed(5)}${failures.length ? `\n    ${failures.join('\n    ')}` : ''}`,
      );
    } catch (error) {
      console.log(
        `✗ ${scenario.id.padEnd(26)} erro: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  console.log(
    `\nAcerto: ${passed}/${scenarios.length} (${Math.round((passed / scenarios.length) * 100)}%) · decisão não registrada pelo modelo: ${undeclared} · custo médio por turno: $${(cost / scenarios.length).toFixed(5)} · latência média: ${Math.round(latency / scenarios.length)}ms`,
  );
  if (passed < scenarios.length) process.exitCode = 1;
}

main();
