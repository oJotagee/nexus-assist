# Build context = raiz do monorepo:
#   docker build -f services/assist/Dockerfile -t nexo-assist .

FROM oven/bun:1.4.2-slim

WORKDIR /usr/src/app

# prisma generate não conecta no banco, mas o prisma.config.ts lê a variável
ENV DATABASE_URL="postgresql://user:password@localhost:5432/dummy"

# Só os manifests primeiro, pra aproveitar cache do bun install.
# A imagem mantém as devDependencies porque o CLI do Prisma roda as migrations no start.
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY services/assist/package.json ./services/assist/

RUN bun install --frozen-lockfile --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/assist ./services/assist

WORKDIR /usr/src/app/services/assist

RUN bunx --bun prisma generate

ENV NODE_ENV=production
ENV PORT=8081
ENV SEED_IF_EMPTY=true

USER bun

EXPOSE 8081

# Bun executa TypeScript direto — não há etapa de compilação
CMD ["sh", "-c", "bunx --bun prisma migrate deploy && bun prisma/seed.ts && bun run src/main.ts"]
