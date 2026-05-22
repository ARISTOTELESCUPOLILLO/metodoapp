export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Slug curto (3–8 chars) do nome da empresa para usar em nomes de arquivo.
 * "Clínica Sorriso Bom" → "clinsorr"
 */
export function companySlug(name: string | undefined | null): string {
  const raw = (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleaned) return 'marca';
  return cleaned.slice(0, 8);
}

/**
 * Carimbo ddmmaa_hhmm em horário local.
 */
export function stamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const dd = p(d.getDate());
  const mm = p(d.getMonth() + 1);
  const aa = p(d.getFullYear() % 100);
  const hh = p(d.getHours());
  const mi = p(d.getMinutes());
  return `${dd}${mm}${aa}_${hh}${mi}`;
}

/**
 * Nome padronizado de arquivo do Método OP:
 *   mop_[empresa]_[tipo]_ddmmaa_hhmm.[ext]
 */
export function mopName(opts: {
  company: string | undefined | null;
  tipo: string;
  ext: string;
  date?: Date;
}): string {
  const slug = companySlug(opts.company);
  const ext = opts.ext.replace(/^\./, '');
  return `mop_${slug}_${opts.tipo}_${stamp(opts.date)}.${ext}`;
}
