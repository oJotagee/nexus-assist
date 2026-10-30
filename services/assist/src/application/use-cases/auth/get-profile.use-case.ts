import { Inject, Injectable } from '@nestjs/common';
import type { UserDto } from '@nexo/shared';

import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../ports/repositories.port';
import { EmployeeNotFoundError } from '@/domain/errors/domain.error';
import { toUserDto } from '../../presenters';

@Injectable()
export class GetProfileUseCase {
  constructor(@Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository) {}

  async execute(employeeId: string): Promise<UserDto> {
    const employee = await this.employees.findById(employeeId);
    if (!employee) throw new EmployeeNotFoundError();

    return toUserDto(employee);
  }
}
