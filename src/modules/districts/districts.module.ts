import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DistrictsService } from './districts.service';
import { DistrictsController } from './districts.controller';

@Module({
  imports: [PrismaModule],
  controllers: [DistrictsController],
  providers: [DistrictsService],
})
export class DistrictsModule {}
