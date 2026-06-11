// D2 — juiz semântico em lote (gpt-4.1-mini), disparado pelo cliente DEPOIS
// de renderizar o resultado (não soma latência ao generate-content). Cobre
// os itens 3/6/8/9 (sem sentido, perde relação com a informação-chave na
// peça de fechamento, genérico demais, não conversa com o segmento) — itens
// que a heurística D1 não cobre. Best-effort: timeout curto e qualquer falha
// é silenciosa, pois o conteúdo já está na tela.

import { MethodOpResult, Segment, ValidationFlag } from '../types';
import { autoRegenerateFlaggedFields } from './autoRegenerate';
import { supabase } from '@/integrations/supabase/client';

interface JudgeContext {
  companyName?: string;
  mainActivity?: string;
  keyInfo?: string;
  segment?: Segment;
}

interface JudgeItem {
  id: string;
  formato?: string;
  titulo?: string;
  texto?: string;
  legenda?: string;
}

function buildItems(result: MethodOpResult): JudgeItem[] {
  const items: JudgeItem[] = [];
  result.feed?.forEach((item, i) => {
    items.push({ id: `feed[${i}]`, formato: item.formato, titulo: item.titulo, texto: item.texto, legenda: item.legenda });
  });
  result.carousel?.forEach((card, i) => {
    items.push({ id: `carousel[${i}]`, formato: 'Carrossel', titulo: card.titulo, texto: card.texto, legenda: card.legenda });
  });
  result.reels?.forEach((r, i) => {
    items.push({ id: `reels[${i}]`, formato: 'Reels', titulo: r.hook, texto: r.script, legenda: r.legenda });
  });
  return items;
}

const JUDGE_TIMEOUT_MS = 15_000;

// Retorna o resultado atualizado (se algum item foi corrigido pela
// regeneração automática) ou `null` se nada mudou / o juiz falhou.
export async function judgeAndRegenerateContent(result: MethodOpResult, ctx: JudgeContext): Promise<MethodOpResult | null> {
  const items = buildItems(result);
  if (items.length === 0) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch('/api/judge-content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        companyName: ctx.companyName,
        mainActivity: ctx.mainActivity,
        keyInfo: ctx.keyInfo,
        segment: ctx.segment,
        items,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const json = await res.json();
    const avaliacoes: { id?: string; campo?: string; motivo?: string }[] = Array.isArray(json.avaliacoes) ? json.avaliacoes : [];
    if (avaliacoes.length === 0) return null;

    const flags: ValidationFlag[] = avaliacoes
      .filter((a) => a.id && a.campo && a.motivo)
      .map((a) => ({ campo: `${a.id}.${a.campo}`, motivo: String(a.motivo) }));
    if (flags.length === 0) return null;

    const flagged: MethodOpResult = { ...result, flags };
    return await autoRegenerateFlaggedFields(flagged, ctx);
  } catch {
    // Best-effort — falha do juiz não afeta o usuário (conteúdo já está na tela).
    return null;
  } finally {
    clearTimeout(timer);
  }
}
