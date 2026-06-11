// E3 — orquestração cliente: regenera automaticamente os campos flagados por
// D1 (ver normalizeMethodResult/textValidation) via regenerate-block, em
// paralelo, com no máximo 2 tentativas por campo. A revalidação após cada
// tentativa usa SOMENTE D1 (a própria resposta de regenerate-block já roda
// validateTitulo/validateTexto/validateLegenda) — nunca um juiz semântico
// (D2), para evitar o loop juiz → regen → juiz.
// Se a 2ª tentativa ainda reprovar, aplica a limpeza determinística (E4).

import { MethodOpResult, ValidationFlag } from '../types';
import { regenerateBlockWithFlags } from './regenerateBlock';
import { applyDeterministicFallback } from '../core/textValidation';

type FieldKind = 'titulo' | 'texto' | 'legenda';

interface AutoRegenContext {
  companyName?: string;
  mainActivity?: string;
  keyInfo?: string;
}

const MAX_ATTEMPTS = 2;
// Acima dessa fração de peças flagadas, regenerações pontuais paralelas não
// compensam (custo/latência) — aplica-se direto a limpeza determinística (E4).
const SKIP_REGEN_THRESHOLD = 0.3;

function resolveFormato(result: MethodOpResult, prefix: string): string {
  const feedMatch = prefix.match(/^feed\[(\d+)\]$/);
  if (feedMatch) return result.feed?.[Number(feedMatch[1])]?.formato || 'Estático';
  if (/^carousel\[\d+\]$/.test(prefix)) return 'Carrossel';
  if (/^reels\[\d+\]$/.test(prefix)) return 'Reels';
  return 'Estático';
}

function getField(result: MethodOpResult, prefix: string, field: FieldKind): string | undefined {
  const feedMatch = prefix.match(/^feed\[(\d+)\]$/);
  if (feedMatch) return result.feed?.[Number(feedMatch[1])]?.[field];

  const carouselMatch = prefix.match(/^carousel\[(\d+)\]$/);
  if (carouselMatch) return result.carousel?.[Number(carouselMatch[1])]?.[field];

  const reelsMatch = prefix.match(/^reels\[(\d+)\]$/);
  if (reelsMatch) {
    const item = result.reels?.[Number(reelsMatch[1])];
    if (!item) return undefined;
    if (field === 'titulo') return item.hook;
    if (field === 'texto') return item.script;
    return item.legenda;
  }
  return undefined;
}

function setField(result: MethodOpResult, prefix: string, field: FieldKind, value: string): void {
  const feedMatch = prefix.match(/^feed\[(\d+)\]$/);
  if (feedMatch) {
    const item = result.feed?.[Number(feedMatch[1])];
    if (item) item[field] = value;
    return;
  }

  const carouselMatch = prefix.match(/^carousel\[(\d+)\]$/);
  if (carouselMatch) {
    const item = result.carousel?.[Number(carouselMatch[1])];
    if (item) item[field] = value;
    return;
  }

  const reelsMatch = prefix.match(/^reels\[(\d+)\]$/);
  if (reelsMatch) {
    const item = result.reels?.[Number(reelsMatch[1])];
    if (!item) return;
    if (field === 'titulo') item.hook = value;
    else if (field === 'texto') item.script = value;
    else item.legenda = value;
  }
}

export async function autoRegenerateFlaggedFields(result: MethodOpResult, ctx: AutoRegenContext): Promise<MethodOpResult> {
  const flags = result.flags;
  if (!flags || flags.length === 0) return result;

  // Agrupa motivos por campo concreto. Flags de "peça inteira" (repetição
  // morfológica título↔texto, promessa numérica sem respaldo) não têm sufixo
  // .titulo/.texto/.legenda — direcionamos para "texto" (mais liberdade de
  // reformulação que o título, com seu limite de sílabas) ou "legenda" se a
  // peça não tiver texto.
  const grouped = new Map<string, { prefix: string; field: FieldKind; motivos: string[] }>();
  for (const flag of flags) {
    const m = flag.campo.match(/^(.*)\.(titulo|texto|legenda)$/);
    let prefix: string;
    let field: FieldKind;
    if (m) {
      prefix = m[1];
      field = m[2] as FieldKind;
    } else {
      prefix = flag.campo;
      field = getField(result, prefix, 'texto') !== undefined ? 'texto' : 'legenda';
    }
    const key = `${prefix}.${field}`;
    const entry = grouped.get(key);
    if (entry) entry.motivos.push(flag.motivo);
    else grouped.set(key, { prefix, field, motivos: [flag.motivo] });
  }

  const totalPieces = (result.feed?.length || 0) + (result.carousel?.length || 0) + (result.reels?.length || 0);
  const flaggedPieces = new Set([...grouped.values()].map((g) => g.prefix)).size;
  const skipRegeneration = totalPieces > 0 && flaggedPieces / totalPieces > SKIP_REGEN_THRESHOLD;

  await Promise.all([...grouped.values()].map(async ({ prefix, field, motivos }) => {
    const current = getField(result, prefix, field) || '';

    if (skipRegeneration) {
      setField(result, prefix, field, applyDeterministicFallback(current, field));
      console.warn(`[autoRegenerate] >${SKIP_REGEN_THRESHOLD * 100}% das peças flagadas — limpeza determinística em ${prefix}.${field}: ${motivos.join('; ')}`);
      return;
    }

    let value = current;
    let motivoReprovacao = motivos.join('; ');

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const regen = await regenerateBlockWithFlags({
          kind: field,
          companyName: ctx.companyName,
          mainActivity: ctx.mainActivity,
          keyInfo: ctx.keyInfo,
          formato: resolveFormato(result, prefix),
          tituloAtual: field === 'titulo' ? value : getField(result, prefix, 'titulo'),
          textoAtual: field === 'texto' ? value : getField(result, prefix, 'texto'),
          legendaAtual: field === 'legenda' ? value : getField(result, prefix, 'legenda'),
          motivoReprovacao,
        });
        value = regen.value;
        if (!regen.flags || regen.flags.length === 0) {
          setField(result, prefix, field, value);
          return;
        }
        motivoReprovacao = regen.flags.join('; ');
        if (attempt === MAX_ATTEMPTS) {
          setField(result, prefix, field, applyDeterministicFallback(value, field));
          console.warn(`[autoRegenerate] ${prefix}.${field} reprovado após ${MAX_ATTEMPTS} tentativas — limpeza determinística aplicada. Motivos: ${motivoReprovacao}`);
        }
      } catch (e) {
        // Falha de rede/timeout no regenerate-block — mantém o valor atual
        // (nunca bloquear a sequência inteira por causa de 1 item).
        console.warn(`[autoRegenerate] regenerate-block falhou para ${prefix}.${field}:`, (e as Error).message);
        return;
      }
    }
  }));

  return { ...result, flags: undefined };
}
