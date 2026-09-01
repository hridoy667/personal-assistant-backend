import {
  Controller,
  Post,
  Delete,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { GenerateSuggestionDto } from './dto/generate-suggestion.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('AI Suggestions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('suggestions')
  @ApiOperation({ summary: 'Generate targeted personal OS suggestions (Uses 1.5h Redis Cache)' })
  @HttpCode(HttpStatus.OK)
  async generateSuggestion(
    @Req() req: any,
    @Body() dto: GenerateSuggestionDto,
  ) {
    return this.aiService.generateSuggestion(dto, req.user.userId);
  }

  @Post('suggestions/refresh')
  @ApiOperation({ summary: 'Delete Redis cache and force re-generate a fresh suggestion' })
  @HttpCode(HttpStatus.OK)
  async refreshSuggestion(
    @Req() req: any,
    @Body() dto: GenerateSuggestionDto,
  ) {
    return this.aiService.refreshSuggestion(dto, req.user.userId);
  }

  @Delete('suggestions/cache')
  @ApiOperation({ summary: 'Purge suggestion cache for user without triggering AI call' })
  @HttpCode(HttpStatus.OK)
  async clearCache(
    @Req() req: any,
    @Body() dto: GenerateSuggestionDto,
  ) {
    const cleared = await this.aiService.clearSuggestionCache(
      req.user.userId,
      dto.contextType,
      dto.userContext,
    );

    return {
      success: true,
      message: cleared
        ? 'Suggestion cache cleared successfully.'
        : 'No active cache found or already invalidated.',
    };
  }
}