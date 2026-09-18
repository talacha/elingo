import { MAX_IMAGE_BASE64_CHARS, type ImageMimeType } from "@/lib/contracts/chat";

export interface CompressedImage {
  mediaType: ImageMimeType;
  /** Base64 sin el prefijo data:...;base64,. */
  data: string;
}

/**
 * Convierte un Blob a base64 sin el prefijo `data:...;base64,`.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Redimensiona y recodifica una imagen en un canvas usando el máximo de dimensión y calidad.
 */
async function redimensionarEnCanvas(
  imageBitmap: ImageBitmap,
  maxDimension: number,
  quality: number,
): Promise<Blob | null> {
  // Calcula el tamaño preservando el aspecto sin agrandar
  let width = imageBitmap.width;
  let height = imageBitmap.height;

  if (width > maxDimension || height > maxDimension) {
    const scale = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  // Usa OffscreenCanvas si está disponible, sino el DOM canvas
  const useOffscreen = typeof OffscreenCanvas !== "undefined";
  const canvas = useOffscreen
    ? new OffscreenCanvas(width, height)
    : document.createElement("canvas");

  if (!useOffscreen) {
    (canvas as HTMLCanvasElement).width = width;
    (canvas as HTMLCanvasElement).height = height;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(imageBitmap, 0, 0, width, height);

  // Intenta convertir a WebP; si no es soportado, recurre a JPEG
  if (useOffscreen && canvas instanceof OffscreenCanvas) {
    try {
      return await canvas.convertToBlob({ type: "image/webp", quality });
    } catch {
      return await canvas.convertToBlob({ type: "image/jpeg", quality });
    }
  } else {
    return new Promise<Blob | null>((resolve) => {
      (canvas as HTMLCanvasElement).toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // Si WebP falla, recurre a JPEG
            (canvas as HTMLCanvasElement).toBlob((jpegBlob) => resolve(jpegBlob), "image/jpeg", quality);
          }
        },
        "image/webp",
        quality,
      );
    });
  }
}

/**
 * Comprime una foto para adjuntarla a un mensaje: redimensiona y recodifica en canvas.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1024,
  quality = 0.7,
): Promise<CompressedImage> {
  let imageBitmap: ImageBitmap;

  // Intenta usar createImageBitmap si está disponible
  if (typeof createImageBitmap !== "undefined") {
    try {
      imageBitmap = await createImageBitmap(file);
    } catch {
      // Fallback a Image + URL.createObjectURL
      imageBitmap = await loadImageWithFallback(file);
    }
  } else {
    imageBitmap = await loadImageWithFallback(file);
  }

  // Redimensiona en canvas
  const blob = await redimensionarEnCanvas(imageBitmap, maxDimension, quality);

  if (!blob) {
    throw new Error("No se pudo comprimir la foto. Prueba con otra.");
  }

  // Convierte a base64
  const base64 = await blobToBase64(blob);

  // Verifica el tamaño
  if (base64.length > MAX_IMAGE_BASE64_CHARS) {
    throw new Error("La foto es demasiado grande incluso comprimida. Prueba con otra.");
  }

  // Determina el tipo MIME
  let mediaType: ImageMimeType = "image/jpeg";
  if (blob.type === "image/webp") {
    mediaType = "image/webp";
  } else if (blob.type === "image/png") {
    mediaType = "image/png";
  }

  return { mediaType, data: base64 };
}

/**
 * Fallback para cargar una imagen con Image cuando createImageBitmap no está disponible o falla.
 * Usa un data: URL (vía FileReader), no URL.createObjectURL: la CSP del sitio permite `data:` en
 * img-src pero no `blob:`, y un blob: URL aquí se bloquearía en silencio (verificado empíricamente).
 */
async function loadImageWithFallback(file: File): Promise<ImageBitmap> {
  const dataUrl = await blobToBase64(file).then((base64) => `data:${file.type};base64,${base64}`);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No se pudo obtener contexto 2D del canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error("No se pudo convertir canvas a blob"));
          return;
        }
        try {
          const bitmap = await createImageBitmap(blob);
          resolve(bitmap);
        } catch (err) {
          reject(err instanceof Error ? err : new Error("No se pudo procesar la foto"));
        }
      });
    };

    img.onerror = () => reject(new Error("No se pudo cargar la foto"));
    img.src = dataUrl;
  });
}
