import { registerAs } from '@nestjs/config';

function readRate(value: string | undefined): number {
  const rate = Number(value ?? 0);
  return Number.isFinite(rate) ? Math.min(Math.max(rate, 0), 1) : 0;
}

export default registerAs('legacyInstability', () => ({
  failureRate: readRate(process.env.TICKETS_FAILURE_RATE),
  maxLatencyMs: Math.max(Number(process.env.TICKETS_MAX_LATENCY_MS ?? 0) || 0, 0),
}));
