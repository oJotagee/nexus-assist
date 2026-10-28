import type { UserDto } from '@nexo/shared';
import { Inject, Injectable } from '@nestjs/common';

import { InvalidCredentialsError } from '@/domain/errors/domain.error';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../ports/repositories.port';
import { TOKEN_ISSUER, type TokenIssuer } from '../../ports/services.port';
import { toUserDto } from '../../presenters';

type LoginInput = { email: string; password: string };
type LoginOutput = { accessToken: string; user: UserDto };

/**
 * Login do protótipo: aceita qualquer funcionário dos dados de exemplo com qualquer senha
 * (requisito do desafio). Num ambiente real, aqui entraria o SSO/AD da empresa.
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
  ) {}

  async execute({ email }: LoginInput): Promise<LoginOutput> {
    const employee = await this.employees.findByEmail(email.trim().toLowerCase());
    if (!employee) throw new InvalidCredentialsError();

    const accessToken = await this.tokens.issue({
      sub: employee.id,
      email: employee.email,
      name: employee.name,
      role: employee.role,
    });

    return { accessToken, user: toUserDto(employee) };
  }
}
