import { Injectable } from '@nestjs/common';

import { Prisma } from '@generated/prisma/client';
import type {
  ClaimResult,
  IdempotencyStore,
  StoredResponse,
} from '@/application/ports/idempotency-store.port';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaIdempotencyStore implements IdempotencyStore {
  constructor(private readonly prisma: PrismaService) {}

  async claim(key: string, requestHash: string): Promise<ClaimResult> {
    try {
      await this.prisma.idempotencyRecord.create({ data: { key, requestHash } });
      return { claimed: true };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      const existing = await this.find(key);
      if (!existing) return this.claim(key, requestHash);
      return { claimed: false, existing };
    }
  }

  async find(key: string): Promise<StoredResponse | null> {
    const record = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
    if (!record) return null;

    return {
      requestHash: record.requestHash,
      statusCode: record.statusCode,
      response: record.response,
    };
  }

  async complete(key: string, statusCode: number, response: unknown): Promise<void> {
    await this.prisma.idempotencyRecord.update({
      where: { key },
      data: {
        statusCode,
        response: response as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  }

  async release(key: string): Promise<void> {
    await this.prisma.idempotencyRecord.deleteMany({ where: { key, statusCode: null } });
  }
}
