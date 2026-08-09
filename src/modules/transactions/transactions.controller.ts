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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Log a new income or expense transaction' })
  create(@Req() req: any, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get cursor-paginated transaction ledger' })
  findAll(@Req() req: any, @Query() pagination: PaginationDto) {
    return this.transactionsService.findAll(req.user.userId, pagination);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a transaction' })
  delete(@Req() req: any, @Param('id') id: string) {
    return this.transactionsService.delete(req.user.userId, id);
  }
}