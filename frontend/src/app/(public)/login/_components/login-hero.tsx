import { Check } from 'lucide-react';

import { NexoLogo } from '@/components/nexo-logo';

const METRICS = [
  { value: '8 s', label: 'primeira resposta, em média' },
  { value: '72%', label: 'resolvidos sem fila' },
  { value: '6', label: 'analistas online agora', live: true },
];

/** Painel de apresentação (Tela 1). Escondido no mobile, onde só o formulário aparece. */
export function LoginHero() {
  return (
    <section className="relative hidden flex-col justify-between overflow-hidden bg-navy px-12 py-10 text-navy-foreground lg:flex">
      <NexoLogo tone="light" />

      <div className="max-w-xl">
        <p className="text-sm text-slate-400">Service desk de TI da Nexo</p>
        <h2 className="mt-4 font-serif text-5xl leading-[1.1] font-normal tracking-tight text-white">
          Seu problema de TI, resolvido em uma conversa.
        </h2>
        <p className="mt-5 max-w-md text-base leading-relaxed text-slate-300">
          Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de
          ajuda e chama um analista quando precisa.
        </p>

        <div
          aria-hidden="true"
          className="mt-10 max-w-md space-y-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-4"
        >
          <p className="ml-auto w-fit rounded-lg bg-white px-3 py-1.5 text-xs text-slate-900">
            Meu notebook não conecta na VPN. Erro 809.
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="font-medium text-slate-200">Nexo Assist</span>
            <Check className="size-3 text-emerald-400" /> consultou seus chamados
            <Check className="size-3 text-emerald-400" /> classificou a prioridade
          </p>
          <p className="w-fit max-w-[85%] rounded-lg bg-white/10 px-3 py-1.5 text-xs text-slate-200">
            Preparei o chamado com prioridade alta. Um analista fala com você em até 4 horas.
          </p>
          <p className="flex w-fit items-center gap-2 rounded-md bg-white/10 px-2.5 py-1 text-[11px] text-slate-200">
            <span className="size-1.5 rounded-full bg-amber-400" />
            INC-20341 · Rede e VPN · prio alta
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
        {METRICS.map((metric) => (
          <div key={metric.label}>
            <dt className="sr-only">{metric.label}</dt>
            <dd className="flex items-center gap-2 font-serif text-3xl text-white tabular-nums">
              {metric.value}
              {metric.live && (
                <span className="size-2 rounded-full bg-emerald-400" aria-hidden="true" />
              )}
            </dd>
            <p className="mt-1 text-xs text-slate-400">{metric.label}</p>
          </div>
        ))}
      </dl>
    </section>
  );
}
