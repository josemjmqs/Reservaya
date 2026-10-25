import { Body, Controller, Param, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('public')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post(':slug/bookings')
  create(@Param('slug') slug: string, @Body() dto: CreateBookingDto) {
    return this.bookings.create(slug, dto);
  }
}