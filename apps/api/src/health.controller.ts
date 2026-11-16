import { Controller, Get } from '@nestjs/common';
import { Access } from './shared/presentation/decorators.js';

@Controller('health')
@Access('guest')
export class HealthController {
  @Get()
  health() {
    return { ok: true };
  }
}
