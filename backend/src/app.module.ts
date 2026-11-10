import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { ServicesModule } from './services/services.module';
import { WorkingHoursModule } from './working-hours/working-hours.module';
import { AvailabilityModule } from './availability/availability.module';
import { BookingsModule } from './bookings/bookings.module';
import { AgendaModule } from './agenda/agenda.module';
import { MembersModule } from './members/members.module';
import { TimeBlocksModule } from './time-blocks/time-blocks.module';
import { StorageModule } from './storage/storage.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 60 peticiones por minuto por IP. THROTTLE_LIMIT solo se sube en las pruebas
    // e2e, donde todas las peticiones del navegador llegan con la misma IP
    ThrottlerModule.forRoot([
      { ttl: 60000, limit: Number(process.env.THROTTLE_LIMIT) || 60 },
    ]),
    PrismaModule,
    StorageModule,
    AuthModule,
    ServicesModule,
    WorkingHoursModule,
    AvailabilityModule,
    BookingsModule,
    AgendaModule,
    MembersModule,
    TimeBlocksModule,
    SettingsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
