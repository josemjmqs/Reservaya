import { Controller, Get, Param, Query } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';

@Controller('public')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get(':slug/availability')
  get(@Param('slug') slug: string, @Query() q: AvailabilityQueryDto) {
    return this.availability.getSlots(slug, q.serviceId, q.date);
  }

  @Get(':slug')
  getBusiness(@Param('slug') slug: string) {
    return this.availability.getBusiness(slug);
  }
}
