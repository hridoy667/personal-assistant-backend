import { Controller, Post, Body, UseGuards, Get, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { GenerateSuggestionDto } from './dto/generate-suggestion.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('AI Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('suggest')
  @ApiOperation({
    summary: 'Generate smart AI-assisted suggestions using Groq LPU',
  })
  async generateSuggestion(@Body() dto: GenerateSuggestionDto) {
    return this.aiService.generateSuggestion(dto);
  }

  @Get('activity')
  async generateActivitySuggestion(@Req() req:any){
    return this.aiService.generateUserContext(req.user.userId);
  }
}