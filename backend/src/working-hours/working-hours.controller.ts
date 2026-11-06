import { Body, Controller, Get, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkingHoursService } from './working-hours.service';
import { SetWorkingHoursDto } from './dto/set-working-hours.dto';

interface AuthenticatedRequest {
  user: { userId: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('working-hours')
export class WorkingHoursController {
  constructor(private readonly hours: WorkingHoursService) {}

  @Get()
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query('memberId') memberId?: string,
  ) {
    return this.hours.findAll(req.user.userId, memberId);
  }

  @Put()
  replace(
    @Request() req: AuthenticatedRequest,
    @Body() dto: SetWorkingHoursDto,
  ) {
    return this.hours.replace(req.user.userId, dto);
  }
}
