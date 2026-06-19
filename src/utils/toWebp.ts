// Converte data URL ou URL de imagem em base64 WebP qualidade 88.
export async function dataUrlToWebpBase64(
  src: string,
  quality = 0.88,
  maxSide = 1280,
): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * ratio);
  canvas.height = Math.round(img.height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas ctx unavailable");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob falhou"))),
      "image/webp",
      quality,
    );
  });
  return await blobToBase64(blob);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const str = String(reader.result || "");
      const i = str.indexOf(",");
      resolve(i >= 0 ? str.slice(i + 1) : str);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
