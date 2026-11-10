import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

// El navegador reduce la foto antes de subirla (~150 KB); 2 MB deja margen
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

interface AuthenticatedRequest {
  user: { userId: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Post()
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateServiceDto) {
    return this.services.create(req.user.userId, dto);
  }

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    return this.services.findAll(req.user.userId);
  }

  @Patch(':id')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.services.update(req.user.userId, id, dto);
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: IMAGE_MAX_BYTES, files: 1 },
    }),
  )
  setImage(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    return this.services.setImage(req.user.userId, id, file);
  }

  @Delete(':id/image')
  removeImage(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.services.removeImage(req.user.userId, id);
  }

  @Delete(':id')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.services.deactivate(req.user.userId, id);
  }
}
