import { Controller, Get, Param, Post } from '@nestjs/common';
import { ManageBookingService } from './manage.service';

@Controller('public/bookings')
export class ManageBookingController {
  constructor(private readonly manage: ManageBookingService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.manage.get(token);
  }

  @Post(':token/cancel')
  cancel(@Param('token') token: string) {
    return this.manage.cancel(token);
  }
}