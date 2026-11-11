import {
  Body,
  Controller,
  Get,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BusinessService } from './business.service';
import { UpdateBusinessDto } from './dto/update-business.dto';

interface AuthenticatedRequest {
  user: { userId: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('business')
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Get()
  get(@Request() req: AuthenticatedRequest) {
    return this.business.get(req.user.userId);
  }

  @Patch()
  update(@Request() req: AuthenticatedRequest, @Body() dto: UpdateBusinessDto) {
    return this.business.update(req.user.userId, dto);
  }
}
