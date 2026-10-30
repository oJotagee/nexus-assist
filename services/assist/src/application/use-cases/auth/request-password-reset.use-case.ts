import { Inject, Injectable, Logger } from '@nestjs/common';

import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../ports/repositories.port';
import { EmployeeNotFoundError } from '@/domain/errors/domain.error';

/** Simulado: num ambiente real dispararia o fluxo de redefinição do AD. */
@Injectable()
export class RequestPasswordResetUseCase {
  private readonly logger = new Logger(RequestPasswordResetUseCase.name);

  constructor(@Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository) {}

  async execute(employeeId: string): Promise<{ sentTo: string }> {
    const employee = await this.employees.findById(employeeId);
    if (!employee) throw new EmployeeNotFoundError();

    this.logger.log(`Link de redefinição de senha (simulado) para ${employee.id}`);

    return { sentTo: employee.email };
  }
}
