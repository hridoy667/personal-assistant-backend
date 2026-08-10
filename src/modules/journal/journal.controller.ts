import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JournalService } from './journal.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpdateJournalDto } from './dto/update-journal.dto';

@ApiTags('Journal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Post()
  @ApiOperation({ summary: 'Create a personal journal entry' })
  create(@Req() req: any, @Body() dto: CreateJournalDto) {
    return this.journalService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get cursor-paginated journal entries' })
  findAll(@Req() req: any, @Query() pagination: PaginationDto) {
    return this.journalService.findAll(req.user.userId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single journal entry by ID' })
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.journalService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing journal entry or reflection' })
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateJournalDto,
  ) {
    return this.journalService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a journal entry' })
  delete(@Req() req: any, @Param('id') id: string) {
    return this.journalService.delete(req.user.userId, id);
  }
}