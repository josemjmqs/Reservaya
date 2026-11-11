import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AgendaController],
  providers: [AgendaService],
})
export class AgendaModule {}
