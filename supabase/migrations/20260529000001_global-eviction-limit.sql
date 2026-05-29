-- Corrige o limite de eviction: de "6 por (user, slot, tipo, formato)" para
-- "48 imagens + 6 renders por usuário globalmente".
--
-- Antes: PU com 1 img/geração → evictava ao atingir 6 imagens (muito cedo).
-- Depois: conta todos os user_assets do usuário e só evicta quando passa de 47
--         (para dar espaço à nova geração). Para renders (reels), mantém ≤ 6.
CREATE OR REPLACE FUNCTION public.list_generations_to_evict(
  _user_id uuid, _slot text, _tipo text, _formato text
)
RETURNS SETOF uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_is_reels  bool   := (_formato = 'reels');
  v_img_limit int    := 48;   -- máx 48 imagens arquivadas por usuário
  v_vid_limit int    := 6;    -- máx 6 renders arquivados por usuário
  v_total     bigint;
  v_excess    bigint;
BEGIN
  IF v_is_reels THEN
    -- Conta todos os renders do usuário (global — todos os slots/tipos)
    SELECT count(*) INTO v_total
      FROM public.user_generations
     WHERE user_id = _user_id AND formato = 'reels';

    v_excess := v_total - (v_vid_limit - 1);
    IF v_excess <= 0 THEN RETURN; END IF;

    RETURN QUERY
      SELECT id FROM public.user_generations
       WHERE user_id = _user_id AND formato = 'reels'
       ORDER BY created_at ASC
       LIMIT v_excess;

  ELSE
    -- Conta total de assets (imagens) do usuário em gerações não-reels
    SELECT count(a.id) INTO v_total
      FROM public.user_assets a
      JOIN public.user_generations g ON a.generation_id = g.id
     WHERE g.user_id = _user_id AND g.formato != 'reels';

    v_excess := v_total - (v_img_limit - 1);
    IF v_excess <= 0 THEN RETURN; END IF;

    -- Evicta as gerações mais antigas até liberar pelo menos v_excess imagens.
    -- A condição "(running_freed - img_count) < v_excess" inclui uma geração se
    -- a soma acumulada ANTES dela ainda não atingiu v_excess (mínimo de gerações
    -- a remover para garantir que sobre espaço para a nova geração).
    RETURN QUERY
      WITH ordered AS (
        SELECT g.id, g.created_at,
               count(a2.id) AS img_count
          FROM public.user_generations g
          LEFT JOIN public.user_assets a2 ON a2.generation_id = g.id
         WHERE g.user_id = _user_id AND g.formato != 'reels'
         GROUP BY g.id, g.created_at
      ),
      cumulative AS (
        SELECT id,
               img_count,
               SUM(img_count) OVER (
                 ORDER BY created_at ASC
                 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
               ) AS running_freed
          FROM ordered
      )
      SELECT id FROM cumulative
       WHERE (running_freed - img_count) < v_excess;

  END IF;
END $$;
