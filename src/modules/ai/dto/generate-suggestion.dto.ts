import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';

export enum SuggestionContextType {
  DAILY_BRIEFING = 'DAILY_BRIEFING',
  TASK_OPTIMIZATION = 'TASK_OPTIMIZATION',
  MENTAL_HEALTH = 'MENTAL_HEALTH',
  PHYSICAL_ACTIVITY = 'PHYSICAL_ACTIVITY',
  FINANCE_ADVICE = 'FINANCE_ADVICE',
  GENERAL = 'GENERAL',
}

export class GenerateSuggestionDto {
  @ApiProperty({
    enum: SuggestionContextType,
    example: SuggestionContextType.TASK_OPTIMIZATION,
    description: 'Target context scope for the AI persona.',
    default: SuggestionContextType.DAILY_BRIEFING,
  })
  @IsEnum(SuggestionContextType, {
    message: `contextType must be one of: ${Object.values(SuggestionContextType).join(', ')}`,
  })
  contextType: SuggestionContextType = SuggestionContextType.DAILY_BRIEFING;

  @ApiPropertyOptional({
    example: 'Tasks due: 3 high priority coding tasks. Screen time: 5 hours.',
    description:
      'Required for TASK_OPTIMIZATION and FINANCE_ADVICE. Optional for DAILY_BRIEFING, MENTAL_HEALTH, PHYSICAL_ACTIVITY, and GENERAL.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString({ message: 'userContext must be a valid text string.' })
  @MaxLength(2000, { message: 'userContext cannot exceed 2000 characters.' })
  userContext?: string;
}