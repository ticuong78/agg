import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { PaidTiers, type PaidTier } from '@agg/contracts';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import type { Response } from 'express';
import type { Requester, UserRequester } from '../../../shared/application/requester.js';
import { Access, CurrentRequester, CurrentUser } from '../../../shared/presentation/decorators.js';
import { LeadService } from '../application/lead.service.js';
import { RewardsService } from '../application/rewards.service.js';
import { TrackingService } from '../application/tracking.service.js';

class VisitBody {
  @IsUUID() visitorId: string;
  @IsString() @MaxLength(300) landingPath: string;
  @IsOptional() @IsString() @MaxLength(300) referrer?: string;
  @IsOptional() @IsString() @MaxLength(100) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(100) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(100) utmCampaign?: string;
  @IsOptional() @IsString() @MaxLength(20) language?: string;
}

class ConsentBody {
  @IsUUID() visitorId: string;
  @IsBoolean() analytics: boolean;
  @IsBoolean() marketing: boolean;
}

class EventBody {
  @IsString() @MaxLength(60) name: string;
  @IsOptional() @IsString() @MaxLength(300) path?: string;
  @IsOptional() @IsObject() props?: Record<string, string | number | boolean>;
}

class EventsBody {
  @IsUUID() visitorId: string;
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => EventBody) events: EventBody[];
}

class GuestLeadBody {
  @IsEmail({}, { message: 'Địa chỉ email không hợp lệ.' }) email: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsBoolean() marketingConsent: boolean;
  @IsOptional() @IsUUID() conversionId?: string;
}

class ContactSalesBody {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsEmail({}, { message: 'Địa chỉ email không hợp lệ.' }) email: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsString() @MinLength(2) @MaxLength(200) organization: string;
  @IsString() @MaxLength(60) organizationType: string;
  @IsOptional() @IsInt() @Min(1) @Max(100_000) seats?: number;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
  @IsIn(PaidTiers) interest: PaidTier;
  @IsBoolean() marketingConsent: boolean;
}

class SurveyBody {
  @IsString() @MaxLength(60) role: string;
  @IsString() @MaxLength(200) organization: string;
  @IsString() @MaxLength(60) organizationType: string;
  @IsString() @MaxLength(60) province: string;
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) subjects: string[];
  @IsString() @MaxLength(30) studentsCount: string;
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) currentTools: string[];
  @IsString() @MaxLength(2000) painPoints: string;
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) interestedFeatures: string[];
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsBoolean() contactConsent: boolean;
}

class FeedbackBody {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsString() @MaxLength(3000) message: string;
}

class BugBody {
  @IsString() @MinLength(5) @MaxLength(200) title: string;
  @IsString() @MaxLength(3000) steps: string;
  @IsString() @MaxLength(2000) expected: string;
  @IsString() @MaxLength(2000) actual: string;
  @IsOptional() @IsUUID() conversionId?: string;
  @IsOptional() @IsString() @MaxLength(300) pageUrl?: string;
}

class ResearchBody {
  @IsString() @MinLength(3) @MaxLength(300) availability: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

class DecisionBody {
  @IsBoolean() approve: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1000) credits?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

@Controller('growth')
@Access('guest')
export class GrowthController {
  constructor(
    private readonly tracking: TrackingService,
    private readonly leads: LeadService,
  ) {}

  @Post('visit') @HttpCode(204)
  async visit(
    @CurrentRequester() r: Requester,
    @Body() body: VisitBody,
    @Headers('user-agent') userAgent?: string,
    // Set by Cloudflare when the API sits behind it; absent otherwise.
    @Headers('cf-ipcountry') country?: string,
  ) {
    await this.tracking.visit(r, body, { userAgent, country });
  }

  @Post('consent') @HttpCode(204)
  async consent(@CurrentRequester() r: Requester, @Body() body: ConsentBody) {
    await this.tracking.consent(r, body);
  }

  @Post('events') @HttpCode(204)
  async events(@CurrentRequester() r: Requester, @Body() body: EventsBody) {
    await this.tracking.track(r, body);
  }

  @Post('leads') @HttpCode(204)
  async lead(@CurrentRequester() r: Requester, @Body() body: GuestLeadBody) {
    await this.leads.guestEmail(r, body);
  }

  @Post('contact-sales') @HttpCode(204)
  async sales(@CurrentRequester() r: Requester, @Body() body: ContactSalesBody) {
    await this.leads.contactSales(r, body);
  }
}

@Controller('rewards')
@Access('user')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get()
  overview(@CurrentUser() user: UserRequester) {
    return this.rewards.overview(user);
  }

  @Post('survey') @HttpCode(200)
  survey(@CurrentUser() user: UserRequester, @Body() body: SurveyBody) {
    return this.rewards.survey(user, body);
  }

  @Post('feedback') @HttpCode(200)
  feedback(@CurrentUser() user: UserRequester, @Body() body: FeedbackBody) {
    return this.rewards.feedback(user, body);
  }

  @Post('bug-report') @HttpCode(200)
  bug(@CurrentUser() user: UserRequester, @Body() body: BugBody) {
    return this.rewards.bugReport(user, body);
  }

  @Post('research') @HttpCode(200)
  research(@CurrentUser() user: UserRequester, @Body() body: ResearchBody) {
    return this.rewards.research(user, body);
  }
}

@Controller('admin')
@Access('admin')
export class AdminGrowthController {
  constructor(
    private readonly leads: LeadService,
    private readonly rewards: RewardsService,
  ) {}

  @Get('leads')
  list(@Query('offset') offset = '0', @Query('limit') limit = '50', @Query('q') q?: string) {
    return this.leads.list(Math.max(0, Number(offset) || 0), Math.min(200, Math.max(1, Number(limit) || 50)), q?.trim() || null);
  }

  @Get('leads.csv')
  async csv(@Res() res: Response, @Query('all') all?: string) {
    const csv = await this.leads.csv(all === 'true');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Get('reviews')
  reviews() {
    return this.rewards.pending();
  }

  @Post('reviews/:id') @HttpCode(204)
  async decide(@Param('id', ParseUUIDPipe) id: string, @Body() body: DecisionBody) {
    await this.rewards.decide(id, body);
  }
}
