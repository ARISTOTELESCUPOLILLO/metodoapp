-- Corrige limite_imagens dos planos S9V e S9C: 58 → 63
-- S9 gera 21 imagens por sequência (3 estáticos + 15 cards carrossel + 3 fechamentos).
-- S9C tem 9 renders = 3 gerações por período → 3 × 21 = 63 imagens (não 58).
-- S9V segue a mesma contagem de imagens (sem renders).
UPDATE public.plans SET limite_imagens = 63 WHERE codigo IN ('S9V', 'S9C');
