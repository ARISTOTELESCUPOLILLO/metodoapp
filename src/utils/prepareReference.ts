// Compacta imagens de referência ANTES de mandar para a IA.
// Objetivo: reduzir payload (base64 inflado) e garantir formato aceito
// pelo gpt-image-2/edit do FAL (que rejeita SVG, PNG com alpha exótico, etc.).
//
// Contrato: sempre devolve um JPEG data-URL válido (fundo branco achatado,
// lado <=1024, q=0.85) — OU null quando não foi possível preparar com segurança
// (CORS, SVG sem dimensões, fetch falha, etc.). Nunca devolve a string original
// "bruta" que pode ser SVG/PNG-alpha e quebrar o screener do FAL.

const MAX_SIDE = 1024;
const JPEG_QUALITY = 0.85;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function detectMime(src: string): string | null {
  if (src.startsWith('data:')) {
    const m = /^data:([^;,]+)[;,]/.exec(src);
    return m ? m[1].toLowerCase() : null;
  }
  if (/^https?:\/\//i.test(src)) {
    const lower = src.split('?')[0].toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    return 'image/*'; // desconhecida — tentamos carregar mesmo assim
  }
  return null;
}

export async function prepareReferenceImage(src: string): Promise<string | null> {
  if (!src || typeof src !== 'string') return null;
  if (typeof document === 'undefined') return null; // SSR safety
  const mime = detectMime(src);
  if (!mime) return null; // formato desconhecido / blob: / file: — descarta
  try {
    const img = await loadImage(src);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Fundo branco achata transparência (PNG com alpha, SVG) — evita
    // que o FAL rejeite a referência por "unsupported format".
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(img, 0, 0, tw, th);
    const out = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    if (!out || !out.startsWith('data:image/jpeg')) return null;
    return out;
  } catch {
    return null;
  }
}

export async function prepareReferenceImages(list: string[] | undefined): Promise<string[]> {
  if (!list || !list.length) return [];
  const prepared = await Promise.all(list.map((s) => prepareReferenceImage(s)));
  return prepared.filter((s): s is string => typeof s === 'string' && s.length > 0);
}
