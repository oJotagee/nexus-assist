/**
 * Migrations e dados de exemplo nos bancos de produção, a partir da sua máquina:
 *
 *   bun run db:prod:generate  gera os clients do Prisma (os outros comandos já geram antes)
 *   bun run db:prod:migrate   aplica as migrations pendentes
 *   bun run db:prod:seed      carrega os dados de exemplo só se o banco estiver vazio
 *   bun run db:prod:reset     APAGA tudo e recarrega os dados de exemplo (pede confirmação)
 *
 * Lê o DATABASE_URL de services/<serviço>/.env.production (fora do git) e o passa explicitamente
 * ao processo filho, para não cair no .env de desenvolvimento.
 */
import { existsSync, readFileSync } from 'node:fs';

const ROOT = `${import.meta.dir}/..`;
const SERVICES = ['tickets', 'assist'] as const;
const SCRIPTS = {
  generate: 'prisma:generate',
  migrate: 'prisma:deploy',
  seed: 'seed',
  reset: 'seed:reset',
} as const;

type Command = keyof typeof SCRIPTS;

function readDatabaseUrl(service: string): string {
  const file = `${ROOT}/services/${service}/.env.production`;
  if (!existsSync(file)) {
    throw new Error(
      `Falta services/${service}/.env.production com DATABASE_URL="<DATABASE_PUBLIC_URL do Postgres no Railway>".`,
    );
  }
  const match = readFileSync(file, 'utf8').match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
  if (!match?.[1])
    throw new Error(`DATABASE_URL não encontrado em services/${service}/.env.production.`);
  return match[1].trim();
}

function describe(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
}

const command = process.argv[2] as Command | undefined;
if (!command || !(command in SCRIPTS)) {
  console.error('Uso: bun scripts/prod-db.ts <generate|migrate|seed|reset>');
  process.exit(1);
}

const targets = SERVICES.map((service) => ({ service, url: readDatabaseUrl(service) }));
for (const { service, url } of targets) console.log(`${service.padEnd(8)} → ${describe(url)}`);

if (command === 'reset') {
  const answer = prompt(
    '\nIsso APAGA todos os dados desses bancos. Digite "apagar" para continuar:',
  );
  if (answer?.trim() !== 'apagar') {
    console.log('Cancelado.');
    process.exit(0);
  }
}

async function run(service: string, url: string, script: string): Promise<void> {
  console.log(`\n▸ ${service}: ${script}`);
  const child = Bun.spawn(['bun', 'run', script], {
    cwd: `${ROOT}/services/${service}`,
    env: { ...process.env, DATABASE_URL: url },
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if ((await child.exited) !== 0) {
    console.error(`\n${service}: ${script} falhou.`);
    process.exit(1);
  }
}

for (const { service, url } of targets) {
  if (command !== 'generate') await run(service, url, 'prisma:generate');
  await run(service, url, SCRIPTS[command]);
}
