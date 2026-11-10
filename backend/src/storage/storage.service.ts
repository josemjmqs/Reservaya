import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

// Fotos en Cloudflare R2 (API compatible con S3). Sin configuración la función
// queda desactivada, igual que el correo sin RESEND_API_KEY
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null = null;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
    this.bucket = config.get<string>('R2_IMAGES_BUCKET') ?? '';
    this.publicUrl = (config.get<string>('R2_PUBLIC_URL') ?? '').replace(
      /\/+$/,
      '',
    );
    // R2_ENDPOINT solo se usa para probar contra un S3 local
    const endpoint =
      config.get<string>('R2_ENDPOINT') ??
      (accountId && `https://${accountId}.r2.cloudflarestorage.com`);

    if (
      endpoint &&
      accessKeyId &&
      secretAccessKey &&
      this.bucket &&
      this.publicUrl
    ) {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.logger.warn(
        'R2 no configurado: la subida de fotos está desactivada',
      );
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  urlFor(key: string | null): string | null {
    return key && this.publicUrl ? `${this.publicUrl}/${key}` : null;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    if (!this.client) throw new Error('R2 no configurado');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // cada foto tiene una ruta nueva, así que puede guardarse en caché para siempre
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  // Nunca lanza: si falla, queda un archivo huérfano pero el servicio sigue funcionando
  async remove(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (e) {
      this.logger.warn(`No se pudo borrar ${key}: ${(e as Error).message}`);
    }
  }
}
