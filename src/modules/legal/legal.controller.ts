import { Controller, Get, Param, BadRequestException } from '@nestjs/common';
import { LegalService } from './legal.service';
import { PolicyType } from '@prisma/client';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get(':type')
  async getPolicy(@Param('type') type: string) {
    const upperType = type.toUpperCase();
    if (upperType !== 'PRIVACY_POLICY' && upperType !== 'TERMS_OF_SERVICE') {
      throw new BadRequestException('Invalid policy type parameters provided');
    }

    return this.legalService.getActivePolicy(upperType as PolicyType);
  }
}