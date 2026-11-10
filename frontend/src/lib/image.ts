import { api } from "@/lib/api";
import type { Service } from "@/lib/types";

const MAX_SIDE = 1200; // px del lado más largo
const QUALITY = 0.82;

// Reduce la foto en el navegador antes de subirla: una foto de celular pasa de
// 3-5 MB a ~150 KB, así sube rápido y casi no ocupa espacio en el bucket
export async function resizeImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("No se pudo leer la imagen. Prueba con una foto JPG o PNG");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));
  // Safari antiguo no genera WebP: en ese caso entrega PNG y usamos JPG
  const webp = await encode("image/webp");
  if (webp?.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg");
  if (!jpeg) throw new Error("No se pudo procesar la imagen");
  return jpeg;
}

export async function uploadServiceImage(serviceId: string, file: File) {
  const blob = await resizeImage(file);
  const body = new FormData();
  body.append("image", blob, blob.type === "image/webp" ? "foto.webp" : "foto.jpg");
  return api<Service>(`/services/${serviceId}/image`, { method: "POST", body });
}

export function removeServiceImage(serviceId: string) {
  return api<Service>(`/services/${serviceId}/image`, { method: "DELETE" });
}
