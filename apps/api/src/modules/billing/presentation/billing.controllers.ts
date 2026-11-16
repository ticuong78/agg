import { Body, Controller, Delete, Get, HttpCode, Ip, Param, ParseUUIDPipe, Patch, Post, Req, Res } from '@nestjs/common';
import { BillingPeriods, PaymentProviders, TierCatalog, TopUpPacks, type BillingPeriod, type PaymentProvider } from '@agg/contracts';
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import type { Request, Response } from 'express';
import type { Requester, UserRequester } from '../../../shared/application/requester.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { Access, CurrentRequester, CurrentUser } from '../../../shared/presentation/decorators.js';
import { CheckoutService } from '../application/checkout.service.js';
import { UsageService } from '../application/usage.service.js';
import { WorkspaceService } from '../application/workspace.service.js';

class ProductBody {
  @IsIn(['PLAN', 'TOPUP']) kind: 'PLAN' | 'TOPUP';
  @IsOptional() @IsIn(['INDIVIDUAL', 'SCHOOL']) tier?: 'INDIVIDUAL' | 'SCHOOL';
  @IsOptional() @IsIn(BillingPeriods) period?: BillingPeriod;
  @IsOptional() @IsInt() @Min(0) @Max(200) extraSeats?: number;
  @IsOptional() @IsString() @MaxLength(32) packId?: string;
}

class CheckoutBody {
  @ValidateNested() @Type(() => ProductBody) product: ProductBody;
  @IsIn(PaymentProviders) provider: PaymentProvider;
  @IsOptional() @IsString() @MaxLength(120) workspaceName?: string;
}

class InviteBody {
  @IsEmail({}, { message: 'Địa chỉ email không hợp lệ.' }) email: string;
}

class WorkspaceBody {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(200) header?: string;
}

@Controller('billing')
export class BillingController {
  constructor(
    private readonly usage: UsageService,
    private readonly checkout: CheckoutService,
  ) {}

  /** Public catalogue (the pricing page can also use the shared constants directly). */
  @Get('catalog') @Access('guest')
  catalog() {
    return { tiers: Object.values(TierCatalog), packs: TopUpPacks, methods: this.checkout.methods() };
  }

  @Get('usage') @Access('guest')
  myUsage(@CurrentRequester() requester: Requester) {
    return this.usage.usage(requester);
  }

  @Get('ledger') @Access('user')
  ledger(@CurrentUser() user: UserRequester) {
    return this.usage.ledger(user);
  }

  @Post('checkout') @HttpCode(200) @Access('user')
  start(@CurrentUser() user: UserRequester, @Body() body: CheckoutBody, @Ip() ip: string) {
    const p = body.product;
    const product = p.kind === 'TOPUP'
      ? { kind: 'TOPUP' as const, packId: required(p.packId) }
      : { kind: 'PLAN' as const, tier: required(p.tier), period: required(p.period), extraSeats: p.extraSeats };
    return this.checkout.checkout(user, { product, provider: body.provider, workspaceName: body.workspaceName }, ip.replace(/^::ffff:/, ''));
  }

  @Get('orders') @Access('user')
  orders(@CurrentUser() user: UserRequester) {
    return this.checkout.listOrders(user);
  }

  @Get('orders/:id') @Access('user')
  order(@CurrentUser() user: UserRequester, @Param('id', ParseUUIDPipe) id: string) {
    return this.checkout.order(user, id);
  }
}

/** Provider notifications. No session: each gateway verifies the provider's signature itself. */
@Controller('billing/webhooks')
@Access('webhook')
export class PaymentWebhooksController {
  constructor(private readonly checkout: CheckoutService) {}

  @Get(':provider') // VNPay IPN is a GET
  async get(@Param('provider') provider: string, @Req() req: Request & { rawBody?: Buffer }, @Res() res: Response) {
    await this.handle(provider, req, res);
  }

  @Post(':provider')
  async post(@Param('provider') provider: string, @Req() req: Request & { rawBody?: Buffer }, @Res() res: Response) {
    await this.handle(provider, req, res);
  }

  private async handle(raw: string, req: Request & { rawBody?: Buffer }, res: Response) {
    const provider = raw.toUpperCase() as PaymentProvider;
    if (!PaymentProviders.includes(provider)) {
      res.status(404).json({ ok: false });
      return;
    }
    const answer = await this.checkout.notify(provider, { headers: req.headers, query: req.query, body: req.body, rawBody: req.rawBody });
    if (answer.body === undefined) res.status(answer.status).end();
    else res.status(answer.status).json(answer.body);
  }
}

@Controller('workspace')
@Access('user')
export class WorkspaceController {
  constructor(private readonly workspaces: WorkspaceService) {}

  @Get()
  mine(@CurrentUser() user: UserRequester) {
    return this.workspaces.mine(user);
  }

  @Patch()
  update(@CurrentUser() user: UserRequester, @Body() body: WorkspaceBody) {
    return this.workspaces.update(user, body);
  }

  @Post('members')
  invite(@CurrentUser() user: UserRequester, @Body() body: InviteBody) {
    return this.workspaces.invite(user, body.email);
  }

  @Delete('members/:email')
  remove(@CurrentUser() user: UserRequester, @Param('email') email: string) {
    return this.workspaces.remove(user, email);
  }
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw DomainError.validation('checkout.invalid_product', 'Thông tin gói chưa đầy đủ.');
  return value;
}
