import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { MoodLevel } from '@prisma/client';

export class CreateJournalDto {
  @ApiPropertyOptional({ example: 'Thoughts on weekly progress' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'Today I made huge breakthroughs in database schema optimization...' })
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: 'https://storage.googleapis.com/bucket/voice_note.mp3' })
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional({ enum: MoodLevel, example: MoodLevel.BALANCED })
  @IsOptional()
  @IsEnum(MoodLevel)
  mood?: MoodLevel;
}