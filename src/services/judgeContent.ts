// D2 — juiz semântico em lote (gpt-4.1-mini), disparado pelo cliente DEPOIS
// de renderizar o resultado (não soma latência ao generate-content). Cobre
// os itens 3/6/8/9 (sem sentido, perde relação com a informação-chave na
// peça de fechamento, genérico demais, não conversa com o segmento) — itens
// que a heurística D1 não cobre. Best-effort: timeout curto e qualquer falha
// é silenciosa, pois o conteúdo já está na tela.

import { MethodOpResult, Segment, ValidationFlag } from '../types';
import { autoRegenerateFlaggedFields, autoRegenerateFlaggedPostUnico, PostUnicoCopyFields } from './autoRegenerate';
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

// Chamada compartilhada ao /api/judge-content — devolve as reprovações
// (avaliacoes) cruas, ou `null` se não houver itens, a request falhar ou
// o timeout estourar. Best-effort: falha do juiz não afeta o usuário
// (conteúdo já está na tela).
async function callJudgeContent(items: JudgeItem[], ctx: JudgeContext): Promise<{ id?: string; campo?: string; motivo?: string }[] | null> {
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
    return Array.isArray(json.avaliacoes) ? json.avaliacoes : [];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Retorna o resultado atualizado (se algum item foi corrigido pela
// regeneração automática) ou `null` se nada mudou / o juiz falhou.
export async function judgeAndRegenerateContent(result: MethodOpResult, ctx: JudgeContext): Promise<MethodOpResult | null> {
  const items = buildItems(result);
  const avaliacoes = await callJudgeContent(items, ctx);
  if (!avaliacoes || avaliacoes.length === 0) return null;

  const flags: ValidationFlag[] = avaliacoes
    .filter((a) => a.id && a.campo && a.motivo)
    .map((a) => ({ campo: `${a.id}.${a.campo}`, motivo: String(a.motivo) }));
  if (flags.length === 0) return null;

  const flagged: MethodOpResult = { ...result, flags };
  return await autoRegenerateFlaggedFields(flagged, ctx);
}

// Variante para o Post Único — mesmo juiz D2, aplicado à peça única
// (titulo/texto). Retorna o par atualizado (se algo foi corrigido pela
// regeneração automática) ou `null` se nada mudou / o juiz falhou.
export async function judgeAndRegeneratePostUnico(copy: PostUnicoCopyFields, ctx: JudgeContext): Promise<PostUnicoCopyFields | null> {
  const items: JudgeItem[] = [{ id: 'copy', formato: 'PostUnico', titulo: copy.titulo, texto: copy.texto }];
  const avaliacoes = await callJudgeContent(items, ctx);
  if (!avaliacoes || avaliacoes.length === 0) return null;

  const flags: ValidationFlag[] = avaliacoes
    .filter((a) => a.id === 'copy' && a.campo && a.motivo)
    .map((a) => ({ campo: `copy.${a.campo}`, motivo: String(a.motivo) }));
  if (flags.length === 0) return null;

  return await autoRegenerateFlaggedPostUnico(copy, flags, ctx);
}
