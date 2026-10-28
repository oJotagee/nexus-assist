import { config } from 'dotenv';

import { defineConfig } from 'prisma/config';

config({
  path: process.cwd().replaceAll('\\', '/').endsWith('/services/tickets')
    ? '.env'
    : 'services/tickets/.env',
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'bun prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
