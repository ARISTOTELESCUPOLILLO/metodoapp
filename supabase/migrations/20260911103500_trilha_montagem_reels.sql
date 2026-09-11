-- TRILHA DA MONTAGEM DO REELS — a escolha da marca (11/09/2026).
--
-- Guarda o ID de uma faixa do acervo curado (src/domain/trilhas.config.ts), ou
-- 'nenhuma' quando a marca prefere o filme só com a locução. NULL = ainda não
-- escolheu, e a montagem usa a trilha padrão.
--
-- ⚠ Não guarda arquivo nem URL, só o ID: o acervo é do sistema, não do usuário.
-- Cliente não sobe música (o risco de direito autoral é da agência, não dele) e
-- trocar uma faixa do acervo não exige mexer em nenhuma conta.
ALTER TABLE user_image_kits ADD COLUMN IF NOT EXISTS trilha text;

COMMENT ON COLUMN user_image_kits.trilha IS
  'ID da trilha escolhida para a montagem do Reels (ver src/domain/trilhas.config.ts). "nenhuma" = sem música. NULL = usa a padrão.';
