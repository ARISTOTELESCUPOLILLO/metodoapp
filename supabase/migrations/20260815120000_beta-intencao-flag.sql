-- Intenção declarada (Fase 1 — PU) — flag de liberação controlada.
--
-- O recurso entra atrás desta flag: ninguém fora da lista vê o campo, e a
-- geração de quem está fora permanece IDÊNTICA à de hoje. A flag também é o
-- botão de desligar: se o piloto der resultado ruim, o recurso sai de uso num
-- update, sem rollback de código e sem tocar em dado gravado.
--
-- Onde a intenção fica GRAVADA: em usage_logs.payload (JSONB), não em coluna
-- própria — decisão do Ari em 15/08/2026. Motivo: não existe "tabela de
-- geração" no app. user_generations só guarda a peça ARQUIVADA (título +
-- caminho do PDF), que é amostra enviesada; usage_logs é a única tabela por
-- onde TODA geração passa. Por isso esta migration cria uma coluna só.
--
-- "Natureza do negócio" também NÃO ganha coluna: é o segmento que o Kit de
-- Marca já grava (brand_kits.segment, espelhado em profiles.segmento).

alter table public.profiles
  add column if not exists beta_intencao boolean not null default false;

comment on column public.profiles.beta_intencao is
  'Piloto do campo de intenção declarada (PU). Ligar/desligar pelo painel do Supabase, sem deploy.';

-- Etapa 1 do piloto — as três contas próprias, uma por natureza de negócio.
-- Rodar manualmente no painel quando o Ari quiser abrir o teste; deixado
-- comentado de propósito para que o deploy não ligue o recurso sozinho.
--
-- update public.profiles set beta_intencao = true
--  where email in (
--    'acupolillo1@gmail.com',        -- SERVIÇOS  — uso normal, referência
--    'acupolillo@uol.com.br',        -- VAREJO    — isolamento da natureza
--    'aristotelescupolillo@gmail.com' -- MARCA    — contraste completo
--  );
