import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, Min, Max, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export enum TaskStatusFilter {
  ALL = 'all',
  PENDING = 'pending',
  COMPLETED = 'completed',
}

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'The ID of the last item from the previous page',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search term to filter tasks' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter tasks by status (all | pending | completed)',
    enum: TaskStatusFilter,
  })
  @IsOptional()
  @IsEnum(TaskStatusFilter)
  status?: TaskStatusFilter;
}