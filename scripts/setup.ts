/**
 * Prepara o ambiente local: bun run setup
 *  1. cria os .env a partir dos .env.example (sem sobrescrever os existentes)
 *  2. sobe o Postgres de dev (Docker) e espera ficar saudável
 *  3. gera os clients do Prisma, aplica as migrations e carrega os dados de exemplo
 */
import { existsSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';

const ROOT = `${import.meta.dir}/..`;
const ENV_FILES = ['services/tickets', 'services/assist', 'frontend'];

async function run(command: string[], label: string): Promise<void> {
  console.log(`\n▸ ${label}`);
  const child = Bun.spawn(command, { cwd: ROOT, stdout: 'inherit', stderr: 'inherit' });
  if ((await child.exited) !== 0) throw new Error(`Falhou: ${label}`);
}

async function waitForPostgres(): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const check = Bun.spawn(
      [
        'docker',
        'compose',
        '-f',
        'docker-compose.dev.yml',
        'exec',
        '-T',
        'postgres',
        'pg_isready',
        '-U',
        'admin',
        '-d',
        'postgres',
      ],
      { cwd: ROOT, stdout: 'ignore', stderr: 'ignore' },
    );
    if ((await check.exited) === 0) return;
    await Bun.sleep(1500);
  }
  throw new Error('O Postgres não ficou pronto. Confira se o Docker está rodando.');
}

for (const dir of ENV_FILES) {
  const target = `${ROOT}/${dir}/.env`;
  if (existsSync(target)) {
    console.log(`• ${dir}/.env já existe (mantido)`);
  } else {
    await copyFile(`${ROOT}/${dir}/.env.example`, target);
    console.log(`• ${dir}/.env criado a partir do exemplo`);
  }
}

await run(['docker', 'compose', '-f', 'docker-compose.dev.yml', 'up', '-d'], 'Subindo o Postgres');
await waitForPostgres();
await run(['bun', 'run', 'db:setup'], 'Migrations e dados de exemplo');

console.log(`
Pronto. Agora:
  bun run dev        # tickets :8082 · assist :8081 · frontend http://localhost:3000

Para as respostas do agent, gere uma chave gratuita em https://aistudio.google.com/apikey
e coloque em GOOGLE_GENERATIVE_AI_API_KEY no arquivo services/assist/.env.`);
