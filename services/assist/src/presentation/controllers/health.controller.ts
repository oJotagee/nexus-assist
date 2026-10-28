import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  check(): { status: 'ok'; service: 'assist' } {
    return { status: 'ok', service: 'assist' };
  }
}
