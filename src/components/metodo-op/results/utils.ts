import { useEffect, useRef } from "react";
import type { BrandKit, ImageKit } from "../../../types";
import { policyPorFormato } from "../../../core/referenciasPolicy";
import { detectForcedGenderFromCopy, PersonagemGender } from "../../../core/visualDirection";
import type { RegenKind } from "../../../services/regenerateBlock";
import type { ModeloOP } from "../../../core/personalizacaoMop";

export function insertSignature(caption: string, signature: string): string {
  const trimmed = caption.trim();
  const lines = trimmed.split("\n");
  let hashStart = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === "" || /^(#\w+\s*)+$/.test(line)) {
      hashStart = i;
    } else {
      break;
    }
  }
  if (hashStart === lines.length) return trimmed + "\n\n" + signature;
  const before = lines.slice(0, hashStart).join("\n").trimEnd();
  const hashBlock = lines.slice(hashStart).join("\n").trimStart();
  return before + "\n\n" + signature + "\n\n" + hashBlock;
}

export function countWords(text: string, excludeTexts?: string[]): number {
  let processed = text.trim();
  if (excludeTexts) {
    for (const exc of excludeTexts) {
      if (exc) processed = processed.split(exc).join("");
    }
  }
  return processed
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !w.startsWith("#")).length;
}

// Nº de imagens geradas em paralelo no "Gerar todas" do carrossel.
export const GENERATE_ALL_CONCURRENCY = 3;

// Roda `worker` para cada item de `items` com no máximo `concurrency` em
// paralelo — usado em "Gerar todas" para não enfileirar as imagens 1 a 1.
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
}

export function shareLegendaWhatsApp(
  tipo: "Estático" | "Estático Final" | "Carrossel" | "Reels",
  legenda: string,
) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const data = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  const text = `Legenda ${tipo} – ${data}\n\n${legenda.trim()}`;
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

// Verifica se o kit tem alguma imagem ENTRE AS PERMITIDAS pela política
// (policyPorFormato) para este (segmento, formato, modelo) — avatar/avatar2,
// cenário ou produto, conforme o que a política libera para o contexto.
export function kitHasRefsForFormat(
  imageKit: ImageKit | undefined,
  formato: "estatico" | "carrossel" | "estatico_final" | "reels",
  segmento: BrandKit["segment"],
  modelo: ModeloOP | null,
): boolean {
  if (!imageKit) return false;
  const policy = policyPorFormato(segmento, formato, modelo);
  return (
    (policy.avatar && (!!imageKit.avatar || !!imageKit.avatar2)) ||
    (policy.fachada && !!imageKit.fachada) ||
    (policy.cenarios > 0 && imageKit.cenarios.some((c) => !!c)) ||
    (policy.produtos > 0 && imageKit.produtos.some((p) => !!p))
  );
}

// Atribui o gênero do personagem para cada peça de um bloco (estático +
// carrossel + fechamento): peças cujo título/texto cite "mulher(es)"
// literalmente ficam com 'mulher' (B2); as demais são balanceadas para que o
// bloco não concentre 5+ das N peças no mesmo gênero por sorteios
// independentes. Resultado é calculado uma única vez por `result` (useMemo) e
// reutilizado em "gerar de novo" — gênero não muda por acaso ao regenerar.
export function computeBlockGenders(
  pieces: { titulo: string; texto: string }[],
  anchorGender?: PersonagemGender,
): PersonagemGender[] {
  const assigned: (PersonagemGender | null)[] = pieces.map((p) =>
    detectForcedGenderFromCopy(p.titulo, p.texto),
  );
  let countMulher = assigned.filter((g) => g === "mulher").length;
  let countHomem = assigned.filter((g) => g === "homem").length;
  for (let i = 0; i < assigned.length; i++) {
    if (assigned[i]) continue;
    let g: PersonagemGender;
    if (anchorGender) {
      g = anchorGender;
    } else if (countMulher < countHomem) {
      g = "mulher";
    } else if (countHomem < countMulher) {
      g = "homem";
    } else {
      g = Math.random() < 0.5 ? "mulher" : "homem";
    }
    assigned[i] = g;
    if (g === "mulher") countMulher++;
    else countHomem++;
  }
  return assigned as PersonagemGender[];
}

export const REGEN_MAX: Record<RegenKind, number> = { titulo: 2, texto: 2, legenda: 2 };

// Resincroniza um campo editável local com o valor vindo de cima (ex.: D2,
// o juiz semântico que corrige a peça em segundo plano depois que o card já
// foi montado/aberto) — só sobrescreve quando o usuário ainda não alterou o
// valor manualmente desde a última sincronização, pra não apagar uma edição
// em andamento.
export function useSyncUpstream(upstream: string, current: string, setValue: (v: string) => void) {
  const prevRef = useRef(upstream);
  useEffect(() => {
    if (upstream !== prevRef.current) {
      if (current === prevRef.current) setValue(upstream);
      prevRef.current = upstream;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `current`/`setValue` são lidos via closure no momento do disparo, não devem re-executar o efeito
  }, [upstream]);
}
