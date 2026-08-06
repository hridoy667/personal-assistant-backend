import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DistrictsService } from './districts.service';
import { PaginationDto } from 'src/common/dtos/pagination.dto';

@ApiTags('districts')
@Controller('districts')
export class DistrictsController {
  constructor(private readonly districtsService: DistrictsService) {}

  @Get()
  @ApiOperation({ summary: 'List districts (for signup and filters)' })
  findAll(@Query() dto: PaginationDto) {
    return this.districtsService.findAll(dto);
  }
}
