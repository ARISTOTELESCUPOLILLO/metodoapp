-- Planos PU: ajuste de limite_geracoes para 5× imgs_limite
-- PU mantém limite de gerações (diferente de MOP) porque permite refinamento
-- textual sem consumo de imagem — margem menor exige controle.
-- Fórmula: geracoes_limite = imgs_limite × 5 (5 tentativas por imagem)
-- PU2: 3 imgs → 15 geracoes | PU4: 6 imgs → 30 | PU8: 12 imgs → 60

UPDATE public.plans SET limite_geracoes = 15 WHERE codigo = 'PU2';
UPDATE public.plans SET limite_geracoes = 30 WHERE codigo = 'PU4';
UPDATE public.plans SET limite_geracoes = 60 WHERE codigo = 'PU8';

UPDATE public.profiles SET plano1_geracoes_limite = 15
  WHERE plano1_id = (SELECT id FROM public.plans WHERE codigo = 'PU2');
UPDATE public.profiles SET plano1_geracoes_limite = 30
  WHERE plano1_id = (SELECT id FROM public.plans WHERE codigo = 'PU4');
UPDATE public.profiles SET plano1_geracoes_limite = 60
  WHERE plano1_id = (SELECT id FROM public.plans WHERE codigo = 'PU8');

UPDATE public.profiles SET plano2_geracoes_limite = 15
  WHERE plano2_id = (SELECT id FROM public.plans WHERE codigo = 'PU2');
UPDATE public.profiles SET plano2_geracoes_limite = 30
  WHERE plano2_id = (SELECT id FROM public.plans WHERE codigo = 'PU4');
UPDATE public.profiles SET plano2_geracoes_limite = 60
  WHERE plano2_id = (SELECT id FROM public.plans WHERE codigo = 'PU8');
