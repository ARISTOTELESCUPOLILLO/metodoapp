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
  const raw = (name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!cleaned) return "marca";
  return cleaned.slice(0, 8);
}

/**
 * Carimbo ddmmaa_hhmm em horário local.
 */
export function stamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
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
  const ext = opts.ext.replace(/^\./, "");
  return `mop_${slug}_${opts.tipo}_${stamp(opts.date)}.${ext}`;
}

const SLOT_LABEL_SLUG: Record<"plano1" | "plano2" | "bonus", string> = {
  plano1: "Plano1",
  plano2: "Plano2",
  bonus: "Bonus",
};

const FORMATO_ABREV: Record<"estatico" | "carrossel" | "estatico_final" | "reels", string> = {
  estatico: "est",
  carrossel: "car",
  estatico_final: "esf",
  reels: "rls",
};

/**
 * Nome de arquivo para downloads do Histórico (peças arquivadas):
 *   [Plano].[dd-mm-aaaa_hhmm].[formato].[numero].[ext]
 * O número final identifica a ordem do card no carrossel — nos demais
 * formatos (imagem única) é sempre 1.
 */
export function archiveFileName(opts: {
  tipo: "S3V" | "PU";
  slot: "plano1" | "plano2" | "bonus";
  formato: "estatico" | "carrossel" | "estatico_final" | "reels";
  createdAt: string | Date;
  numero?: number;
  ext: string;
}): string {
  const d = typeof opts.createdAt === "string" ? new Date(opts.createdAt) : opts.createdAt;
  const p2 = (n: number) => String(n).padStart(2, "0");
  const dataHora = `${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${d.getFullYear()}_${p2(d.getHours())}${p2(d.getMinutes())}`;
  const formatoAbrev = opts.tipo === "PU" ? "post" : FORMATO_ABREV[opts.formato] || opts.formato;
  const numero = p2(opts.numero ?? 1);
  const ext = opts.ext.replace(/^\./, "");
  return `${SLOT_LABEL_SLUG[opts.slot]}.${dataHora}.${formatoAbrev}.${numero}.${ext}`;
}
