import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GmailService } from './gmail.service';
import { IngestSyncedEmailDto, ConvertEmailToTaskDto } from './dto/gmail.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Gmail Sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gmail')
export class GmailController {
  constructor(private readonly gmailService: GmailService) {}

  @Post('ingest')
  @ApiOperation({ summary: 'Ingest inbound email from mobile app or webhook' })
  ingestEmail(@Req() req: any, @Body() dto: IngestSyncedEmailDto) {
    return this.gmailService.ingestEmail(req.user.userId, dto);
  }

  @Get('emails')
  @ApiOperation({ summary: 'Get cursor-paginated list of synced emails' })
  getSyncedEmails(@Req() req: any, @Query() pagination: PaginationDto) {
    return this.gmailService.getSyncedEmails(req.user.userId, pagination);
  }

  @Post('emails/:id/convert-task')
  @ApiOperation({ summary: 'Convert an email into an actionable Task' })
  convertToTask(
    @Req() req: any,
    @Param('id') emailId: string,
    @Body() dto: ConvertEmailToTaskDto,
  ) {
    return this.gmailService.convertToTask(req.user.userId, emailId, dto);
  }
}