import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  check(): { status: 'ok'; service: 'tickets' } {
    return { status: 'ok', service: 'tickets' };
  }
}
