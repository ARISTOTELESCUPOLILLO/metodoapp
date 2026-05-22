// Redimensiona uma imagem (File ou dataURL) para que o maior lado tenha no máximo `maxSide` px,
// mantendo a proporção. Saída: dataURL WEBP qualidade 0.85 — bom equilíbrio peso/qualidade
// para uso como referência visual em modelos de edição de imagem.

const DEFAULT_MAX = 768;
const DEFAULT_QUALITY = 0.85;

export interface ResizeOptions {
  maxSide?: number;
  quality?: number;
  mimeType?: 'image/webp' | 'image/jpeg' | 'image/png';
}

export async function resizeImage(
  source: File | Blob | string,
  opts: ResizeOptions = {},
): Promise<string> {
  const maxSide = opts.maxSide ?? DEFAULT_MAX;
  const quality = opts.quality ?? DEFAULT_QUALITY;
  const mimeType = opts.mimeType ?? 'image/webp';

  const dataUrl = typeof source === 'string' ? source : await fileToDataUrl(source);
  const img = await loadImage(dataUrl);

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error('Imagem inválida.');

  const longest = Math.max(w, h);
  const scale = longest > maxSide ? maxSide / longest : 1;
  const dw = Math.round(w * scale);
  const dh = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível criar o canvas.');
  ctx.drawImage(img, 0, 0, dw, dh);
  return canvas.toDataURL(mimeType, quality);
}

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar a imagem.'));
    img.src = src;
  });
}

// Validação: tamanho e tipo aceitos pelo Kit Imagem.
export const ACCEPTED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_MIME.includes(file.type.toLowerCase())) {
    return 'Formato não aceito. Envie JPG, PNG ou WEBP.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'Arquivo muito grande. Limite: 5 MB.';
  }
  return null;
}
