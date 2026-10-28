import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle({ default: true })
@Controller('health')
export class HealthController {
  @Get('live')
  live() {
    return { status: 'ok' };
  }
}
