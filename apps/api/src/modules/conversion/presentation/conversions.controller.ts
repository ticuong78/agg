import {
  Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Res, StreamableFile, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ACCESS_KEY_HEADER, ExportFormats, IoModes, TextSections, type ExportFormat, type IoMode, type TextSection } from '@agg/contracts';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import type { Response } from 'express';
import { RateLimiter } from '../../../shared/application/rate-limiter.js';
import { enforceRateLimit } from '../../../shared/application/rate-limit.js';
import type { Requester, UserRequester } from '../../../shared/application/requester.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { Access, CurrentRequester, CurrentUser, Mvp, utf8Name } from '../../../shared/presentation/decorators.js';
import { AiEditingService } from '../application/ai-editing.service.js';
import { ConversionService } from '../application/conversion.service.js';
import { ExportService } from '../application/export.service.js';

/** Hard ceiling of the HTTP layer; each tier's own (lower) limit is enforced by the application. */
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 50) * 1024 * 1024;
const MAX_UPLOAD_FILES = 30;

class PasteBody {
  @IsString() @MaxLength(200_000, { message: 'Nội dung dài quá 200.000 ký tự. Hãy chia thành nhiều lần.' }) text: string;
}

class TestBody {
  @IsOptional() @IsString() @MaxLength(64) id?: string;
  @IsString() input: string;
  @IsString() output: string;
  @IsBoolean() isSample: boolean;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) score: number;
  @IsOptional() @IsString() @MaxLength(300) purpose?: string;
  @IsOptional() @IsBoolean() verified?: boolean;
}

class UpdateProblemBody {
  @IsOptional() @IsString() @MaxLength(16) code?: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(50_000) statement?: string;
  @IsOptional() @IsString() @MaxLength(50_000) inputFormat?: string;
  @IsOptional() @IsString() @MaxLength(50_000) outputFormat?: string;
  @IsOptional() @IsString() @MaxLength(50_000) constraints?: string;
  @IsOptional() @IsInt() timeLimitMs?: number;
  @IsOptional() @IsInt() memoryLimitMb?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => TestBody) tests?: TestBody[];
}

class SettingsBody {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsIn(IoModes) ioMode?: IoMode;
  @IsOptional() @IsString() @MaxLength(200) header?: string;
  @IsOptional() @IsBoolean() includeStatements?: boolean;
}

class OrderBody {
  @IsArray() @ArrayMaxSize(300) @IsUUID('4', { each: true }) problemIds: string[];
}

class RewriteBody {
  @IsIn(TextSections) section: TextSection;
  @IsOptional() @IsString() @MaxLength(500) instruction?: string;
}

class SuggestBody {
  @Type(() => Number) @IsInt() @Min(1) @Max(10) count: number;
  @IsOptional() @IsString() @MaxLength(1000) focus?: string;
}

@Controller('conversions')
@Access('guest')
export class ConversionsController {
  constructor(
    private readonly conversions: ConversionService,
    private readonly ai: AiEditingService,
    private readonly exports: ExportService,
    private readonly limiter: RateLimiter,
  ) {}

  @Get('formats') @Mvp()
  formats() {
    return this.exports.formats();
  }

  @Post() @Mvp()
  @UseInterceptors(FilesInterceptor('files', MAX_UPLOAD_FILES, { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(@CurrentRequester() requester: Requester, @UploadedFiles() files?: Express.Multer.File[]) {
    if (!files?.length) throw DomainError.validation('conversion.no_source', 'Hãy chọn ít nhất một tệp.');
    await this.limitUploads(requester);
    return this.conversions.createFromFiles(requester, files.map((f) => ({ name: utf8Name(f.originalname), buffer: f.buffer })));
  }

  @Post('text') @Mvp()
  async paste(@CurrentRequester() requester: Requester, @Body() body: PasteBody) {
    await this.limitUploads(requester);
    return this.conversions.createFromText(requester, body.text);
  }

  @Get() @Access('user')
  list(@CurrentUser() user: UserRequester) {
    return this.conversions.list(user);
  }

  @Get(':id') @Mvp()
  get(@CurrentRequester() requester: Requester, @Param('id', ParseUUIDPipe) id: string, @Headers(ACCESS_KEY_HEADER) key?: string) {
    return this.conversions.get(requester, id, key ?? null);
  }

  @Post(':id/claim') @HttpCode(200) @Access('user')
  claim(@CurrentUser() user: UserRequester, @Param('id', ParseUUIDPipe) id: string, @Headers(ACCESS_KEY_HEADER) key?: string) {
    return this.conversions.claim(user, id, key ?? null);
  }

  @Delete(':id') @HttpCode(204) @Mvp()
  async remove(@CurrentRequester() requester: Requester, @Param('id', ParseUUIDPipe) id: string, @Headers(ACCESS_KEY_HEADER) key?: string) {
    await this.conversions.delete(requester, id, key ?? null);
  }

  @Patch(':id/settings') @Mvp()
  settings(@CurrentRequester() r: Requester, @Param('id', ParseUUIDPipe) id: string, @Body() body: SettingsBody, @Headers(ACCESS_KEY_HEADER) key?: string) {
    return this.conversions.updateSettings(r, id, key ?? null, body);
  }

  @Put(':id/order') @Mvp()
  reorder(@CurrentRequester() r: Requester, @Param('id', ParseUUIDPipe) id: string, @Body() body: OrderBody, @Headers(ACCESS_KEY_HEADER) key?: string) {
    return this.conversions.reorder(r, id, key ?? null, body.problemIds);
  }

  @Patch(':id/problems/:problemId') @Mvp()
  updateProblem(
    @CurrentRequester() r: Requester,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Body() body: UpdateProblemBody,
    @Headers(ACCESS_KEY_HEADER) key?: string,
  ) {
    return this.conversions.updateProblem(r, id, key ?? null, problemId, body);
  }

  @Delete(':id/problems/:problemId') @Mvp()
  removeProblem(
    @CurrentRequester() r: Requester,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Headers(ACCESS_KEY_HEADER) key?: string,
  ) {
    return this.conversions.removeProblem(r, id, key ?? null, problemId);
  }

  @Post(':id/problems/:problemId/rewrite') @HttpCode(200)
  async rewrite(
    @CurrentRequester() r: Requester,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Body() body: RewriteBody,
    @Headers(ACCESS_KEY_HEADER) key?: string,
  ) {
    await enforceRateLimit(this.limiter, `ai:${r.kind === 'user' ? r.userId : r.ipHash}`, 60, 3600);
    return this.ai.rewrite(r, id, key ?? null, problemId, body);
  }

  @Post(':id/problems/:problemId/suggest-tests') @HttpCode(200)
  async suggest(
    @CurrentRequester() r: Requester,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Body() body: SuggestBody,
    @Headers(ACCESS_KEY_HEADER) key?: string,
  ) {
    await enforceRateLimit(this.limiter, `ai:${r.kind === 'user' ? r.userId : r.ipHash}`, 60, 3600);
    return this.ai.suggestTests(r, id, key ?? null, problemId, body);
  }

  @Get(':id/export/:format') @Mvp()
  async export(
    @CurrentRequester() r: Requester,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('format') format: string,
    @Res({ passthrough: true }) res: Response,
    @Headers(ACCESS_KEY_HEADER) key?: string,
  ) {
    if (!(ExportFormats as readonly string[]).includes(format)) {
      throw DomainError.validation('export.unknown_format', 'Định dạng xuất không được hỗ trợ.');
    }
    const file = await this.exports.export(r, id, key ?? null, format as ExportFormat);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName(file.fileName)}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(file.content);
  }

  private async limitUploads(requester: Requester) {
    const key = requester.kind === 'user' ? `upload:user:${requester.userId}` : `upload:ip:${requester.ipHash}`;
    await enforceRateLimit(this.limiter, key, requester.kind === 'user' ? 120 : 20, 3600);
  }
}

/** Fallback file name for old clients: Vietnamese letters stripped to ASCII. */
const asciiName = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
