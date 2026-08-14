import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum SuggestionContextType {
  DAILY_BRIEFING = 'DAILY_BRIEFING',
  TASK_OPTIMIZATION = 'TASK_OPTIMIZATION',
  WELLBEING_TIP = 'WELLBEING_TIP',
  FINANCE_ADVICE = 'FINANCE_ADVICE',
  GENERAL = 'GENERAL',
}

export class GenerateSuggestionDto {
  @ApiProperty({
    enum: SuggestionContextType,
    example: SuggestionContextType.DAILY_BRIEFING,
    description: 'Context category for the AI engine',
  })
  @IsEnum(SuggestionContextType)
  contextType!: SuggestionContextType;

  @ApiPropertyOptional({
    example: 'User spent 4 hours on Social Media, slept 6 hours, and has 3 critical tasks due.',
    description: 'Contextual JSON string or text data to feed into the prompt',
  })
  @IsOptional()
  @IsString()
  userContext?: string;
}