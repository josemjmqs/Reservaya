import { detectImageType } from './image-type';

const bytes = (...b: number[]) => Buffer.from(b);

describe('detectImageType', () => {
  it('reconoce JPG, PNG y WebP por su firma', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe('jpg');
    expect(
      detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))
        ?.ext,
    ).toBe('png');
    expect(
      detectImageType(
        Buffer.concat([
          Buffer.from('RIFF'),
          bytes(0, 0, 0, 0),
          Buffer.from('WEBP'),
        ]),
      )?.ext,
    ).toBe('webp');
  });

  it('rechaza otros archivos aunque digan ser imágenes', () => {
    expect(
      detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageType(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
