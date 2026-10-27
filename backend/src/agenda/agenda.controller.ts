import { Body, Controller, Get, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgendaService } from './agenda.service';
import { ListAgendaDto } from './dto/list-agenda.dto';
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
    return this.agenda.list(req.user.userId, q.from, q.to);
  }

  @Patch(':id/status')
  updateStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.agenda.updateStatus(req.user.userId, id, dto.status);
  }
}