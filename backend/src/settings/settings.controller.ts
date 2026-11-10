import {
  Body,
  Controller,
  Get,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

interface AuthenticatedRequest {
  user: { userId: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@Request() req: AuthenticatedRequest) {
    return this.settings.get(req.user.userId);
  }

  @Patch()
  update(@Request() req: AuthenticatedRequest, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(req.user.userId, dto.newBookingEmail);
  }
}
