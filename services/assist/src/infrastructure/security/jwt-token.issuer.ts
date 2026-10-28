import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { SessionTokenPayload, TokenIssuer } from '@/application/ports/services.port';
import jwtConfig from '../config/jwt.config';

@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(
    private readonly jwt: JwtService,
    @Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>,
  ) {}

  issue(payload: SessionTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.secret,
      algorithm: 'HS256',
      expiresIn: this.config.expiresIn as `${number}h`,
    });
  }
}
