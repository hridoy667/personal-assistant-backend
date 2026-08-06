import { PartialType } from '@nestjs/swagger';
import { CreateDashbordDto } from './create-dashbord.dto';

export class UpdateDashbordDto extends PartialType(CreateDashbordDto) {}
