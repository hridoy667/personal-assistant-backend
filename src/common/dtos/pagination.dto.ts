import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'The ID of the last item from the previous page',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @Type(() => Number) // Ensures the string from the URL is converted to a number
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search term to filter district names' })
  @IsOptional()
  @IsString()
  search?: string;
}
