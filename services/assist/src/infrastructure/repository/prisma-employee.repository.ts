import { Injectable } from '@nestjs/common';

import type { EmployeeRepository } from '@/application/ports/repositories.port';
import type { EmployeeRecord } from '@/domain/entities/message';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<EmployeeRecord | null> {
    return this.prisma.employee.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<EmployeeRecord | null> {
    return this.prisma.employee.findUnique({ where: { email } });
  }

  findManyByIds(ids: string[]): Promise<EmployeeRecord[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.employee.findMany({ where: { id: { in: ids } } });
  }
}
