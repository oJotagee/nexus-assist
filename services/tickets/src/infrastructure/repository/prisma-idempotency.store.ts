import { Injectable } from '@nestjs/common';

import { Prisma } from '@generated/prisma/client';
import type { IdempotencyStore, StoredResponse } from '@/application/ports/idempotency-store.port';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaIdempotencyStore implements IdempotencyStore {
  constructor(private readonly prisma: PrismaService) {}

  async find(key: string): Promise<StoredResponse | null> {
    const record = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
    if (!record) return null;

    return {
      requestHash: record.requestHash,
      statusCode: record.statusCode,
      response: record.response,
    };
  }

  async save(key: string, stored: StoredResponse): Promise<boolean> {
    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          key,
          requestHash: stored.requestHash,
          statusCode: stored.statusCode,
          response: stored.response as Prisma.InputJsonValue,
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }
}
