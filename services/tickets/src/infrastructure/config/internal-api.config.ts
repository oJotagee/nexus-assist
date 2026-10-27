import { registerAs } from '@nestjs/config';

export default registerAs('internalApi', () => ({
  secret: process.env.INTERNAL_API_SECRET,
}));
