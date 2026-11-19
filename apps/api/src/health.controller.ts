import { Controller, Get } from '@nestjs/common';
import { Access, Mvp } from './shared/presentation/decorators.js';

@Controller('health')
@Access('guest')
@Mvp()
export class HealthController {
  @Get()
  health() {
    return { ok: true };
  }
}
