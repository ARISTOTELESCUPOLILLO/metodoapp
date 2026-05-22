// Coleta previews gerados pelos cards do MOP para envio em lote ao histórico.
// Não persiste — vive em memória enquanto o usuário está na tela de resultados.
const map = new Map<string, string>();
let counter = 0;
const listeners = new Set<() => void>();

export function recordPreview(key: string, dataUrl: string) {
  map.set(key, dataUrl);
  counter += 1;
  listeners.forEach((l) => l());
}

export function clearPreviews() {
  map.clear();
  counter = 0;
  listeners.forEach((l) => l());
}

export function listPreviews(): { key: string; dataUrl: string }[] {
  return Array.from(map.entries()).map(([key, dataUrl]) => ({ key, dataUrl }));
}

export function previewCount() {
  return map.size;
}

export function subscribePreviews(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
