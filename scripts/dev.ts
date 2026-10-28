/**
 * Sobe os três serviços em modo dev, com os logs prefixados: bun run dev
 * Ctrl+C encerra todos.
 */
const ROOT = `${import.meta.dir}/..`;

const SERVICES = [
  { name: 'tickets ', color: '\x1b[33m', command: ['bun', 'run', 'dev:tickets'] },
  { name: 'assist  ', color: '\x1b[36m', command: ['bun', 'run', 'dev:assist'] },
  { name: 'frontend', color: '\x1b[35m', command: ['bun', 'run', 'dev:frontend'] },
];
const RESET = '\x1b[0m';

async function pipe(stream: ReadableStream<Uint8Array>, prefix: string): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) if (line.trim()) console.log(`${prefix} ${line}`);
  }
}

const processes = SERVICES.map((service) => {
  const child = Bun.spawn(service.command, { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
  const prefix = `${service.color}${service.name}${RESET} │`;
  void pipe(child.stdout, prefix);
  void pipe(child.stderr, prefix);
  return { ...service, child };
});

function shutdown(): void {
  for (const { child } of processes) child.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const first = await Promise.race(
  processes.map(async ({ name, child }) => ({ name, code: await child.exited })),
);
console.error(`\n${first.name.trim()} encerrou (código ${first.code}). Encerrando os demais.`);
shutdown();
