import { registerAs } from '@nestjs/config';

export default registerAs('ticketsApi', () => ({
  baseUrl: process.env.TICKETS_API_URL ?? 'http://localhost:8082',
  secret: process.env.INTERNAL_API_SECRET,
  retryDelaysMs: undefined as number[] | undefined,
}));
