import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { ServicesModule } from './services/services.module';
import { WorkingHoursModule } from './working-hours/working-hours.module';
import { AvailabilityModule } from './availability/availability.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, ServicesModule, WorkingHoursModule, AvailabilityModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
