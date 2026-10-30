import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { ManageBookingController } from './manage.controller';
import { ManageBookingService } from './manage.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AvailabilityModule, NotificationsModule],
  controllers: [BookingsController, ManageBookingController],
  providers: [BookingsService, ManageBookingService],
})
export class BookingsModule {}