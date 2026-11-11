import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgendaService } from './agenda.service';
import { ListAgendaDto, NextAgendaDto } from './dto/list-agenda.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

interface AuthenticatedRequest {
  user: { userId: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('agenda')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get()
  list(@Request() req: AuthenticatedRequest, @Query() q: ListAgendaDto) {
    return this.agenda.list(req.user.userId, q.from, q.to, q.memberId);
  }

  @Get('next')
  next(@Request() req: AuthenticatedRequest, @Query() q: NextAgendaDto) {
    return this.agenda.next(req.user.userId, q.memberId);
  }

  @Patch(':id/status')
  updateStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.agenda.updateStatus(
      req.user.userId,
      id,
      dto.status,
      dto.reason,
    );
  }
}
