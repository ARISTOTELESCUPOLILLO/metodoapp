-- Informação-chave Editorial (Beta) — flag de liberação controlada.
--
-- Mesmo contrato de beta_intencao (20260815120000): o recurso entra atrás
-- desta flag, ninguém fora da lista vê os campos novos, e a geração de quem
-- está fora permanece IDÊNTICA à de hoje — o caminho Legacy da Sugestão
-- (assunto curto de 4-9 palavras, core/sugestaoEngine.ts) não é tocado.
--
-- A flag também é o botão de desligar: se o piloto der resultado ruim, o
-- recurso sai de uso num update no painel do Supabase, sem rollback de código
-- e sem tocar em dado gravado.
--
-- POR QUE UMA COLUNA, e não uma variável de ambiente: o projeto já tem este
-- padrão de flag por conta (repository/betaFlags.ts) e o pedido é explícito em
-- não criar mecanismo paralelo quando já existe solução equivalente. Uma flag
-- global por env ligaria o recurso para todos de uma vez, que é o oposto de
-- piloto.
--
-- Onde a Linha Editorial fica GRAVADA: em usage_logs.payload (JSONB), junto do
-- que já é gravado da intenção declarada — mesma decisão de 15/08/2026, pelo
-- mesmo motivo (não existe "tabela de geração" no app; usage_logs é a única
-- por onde TODA geração passa). Por isso esta migration cria uma coluna só.

alter table public.profiles
  add column if not exists beta_editorial boolean not null default false;

comment on column public.profiles.beta_editorial is
  'Piloto da Informação-chave Editorial (Linha Editorial + uso do objeto, PU e MOP). Ligar/desligar pelo painel do Supabase, sem deploy.';

-- Etapa 1 do piloto — as contas próprias, uma por natureza de negócio.
-- Rodar manualmente no painel quando o Ari quiser abrir o teste; deixado
-- comentado de propósito para que o deploy não ligue o recurso sozinho.
--
-- update public.profiles set beta_editorial = true
--  where email in (
--    'acupolillo1@gmail.com',         -- SERVIÇOS — uso normal, referência
--    'acupolillo@uol.com.br',         -- VAREJO   — isolamento da natureza
--    'aristotelescupolillo@gmail.com' -- MARCA    — contraste completo
--  );
