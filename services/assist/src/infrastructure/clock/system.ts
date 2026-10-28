import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import type { Clock, IdGenerator } from '@/application/ports/services.port';

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

@Injectable()
export class UuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
