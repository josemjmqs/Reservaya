import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TimeBlocksService } from './time-blocks.service';
import { CreateTimeBlockDto } from './dto/create-time-block.dto';

interface AuthenticatedRequest {
  user: { userId: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('time-blocks')
export class TimeBlocksController {
  constructor(private readonly blocks: TimeBlocksService) {}

  @Get()
  list(@Request() req: AuthenticatedRequest) {
    return this.blocks.list(req.user.userId);
  }

  @Post()
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateTimeBlockDto,
  ) {
    return this.blocks.create(req.user.userId, dto);
  }

  @Delete(':id')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.blocks.remove(req.user.userId, id);
  }
}
