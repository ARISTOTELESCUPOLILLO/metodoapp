# Método OP — Instruções do Projeto

## Stack técnica
- **Runtime:** Cloudflare Workers (edge, sem Node.js nativo)
- **Framework:** TanStack Start (React + TanStack Router, file-based routes)
- **Build:** Vite + @cloudflare/vite-plugin
- **Banco de dados:** Supabase (PostgreSQL, RLS, Storage)
- **Geração de texto:** OpenAI GPT-4.1
- **Geração de imagem:** fal.ai (fila) → modelo `openai/gpt-image-2` / `gpt-image-2/edit`
- **Áudio/narração:** ElevenLabs
- **Deploy:** `npm run deploy` → vite build + wrangler deploy
- **Linguagem:** TypeScript (strict), React 18, CSS-in-JS via Tailwind

## Estrutura principal
```
src/
  MetodoOpApp.tsx          # componente raiz da app (MOP + PU)
  routes/                  # rotas TanStack (/app, /historico, /conta, /admin)
  components/
    metodo-op/             # componentes do MOP e PU
    admin/                 # painel admin (UsersTab, CobrancasTab, etc.)
  core/
    organizaMethodEngine.ts   # motor de geração MOP
    visualDirection.ts        # regras de imagem (hierarquia produto/personagem)
    referenciasPolicy.ts      # policy de referências por segmento/formato
    personalizacaoMop.ts      # slots e formatos (S3V, S6V, S9V, carrossel, reels)
  services/
    postUnico.ts              # motor de geração PU
    regenerateWithKit.ts      # regen MOP com Kit Imagem
    brandKit.ts               # CRUD + server functions do Kit de Marca (Supabase)
    api.ts                    # chamadas OpenAI e fal.ai
  lib/
    imageKit.functions.ts     # server functions Kit Imagem (Supabase Storage)
  hooks/
    useAuth.ts                # autenticação Supabase
    useImpersonation.ts       # modo admin "Atuar como"
    usePlanSlots.ts           # planos e limites de uso
  utils/
    storage.ts                # localStorage (form, kit, form-owner)
    sessionImageCache.ts      # cache de imagens MOP em memória + localStorage
    imageKitStorage.ts        # cache local do Kit Imagem
  types.ts                   # interfaces principais (BrandKit, ContentFormData, etc.)
supabase/
  migrations/                # histórico de migrations SQL
```

## Conceitos centrais do negócio

### Trilhas de conteúdo
- **MOP (Método OP):** sequências S3V/S6V/S9V + variante cinematica/visual/experimentacao. Gera 3, 6 ou 9 peças em carrossel, reels e estático.
- **PU (Post Único):** peça avulsa com objetivo (Oportunidade, Marca, Fato, Venda, Aviso, Homenagem, Nenhum).

### Segmentos
- **VAREJO:** produto é herói. Produtos em estático/final só nesse segmento.
- **SERVIÇOS:** personagem é protagonista. Produto é apoio.
- **MARCA:** equilíbrio 50/50 produto×personagem (ou personagem domina se marca pessoal).

### Kit de Marca (BrandKit)
Empresa, segmento, logo, cores, fontes, voz da marca, uniforme, produtos cadastrados.

### Kit Imagem (ImageKit)
Fotos reais: avatar (1 ou 2), fachada, cenários (2), produtos (até 8), fato, venda.
Armazenado no Supabase Storage (bucket `image-kits`). Admin usa `rpc("has_role")` para bypass de RLS.

### Referências visuais (buildReferences)
Função central em `regenerateWithKit.ts` — monta `PostUnicoReferences` a partir de seleção + policy por segmento/formato. Compartilhada entre MOP e PU.

### Policy de referências (referenciasPolicy.ts)
- `policyPorFormato(segmento, formato, modelo)` — retorna limites `{avatar, fachada, cenarios, produtos}`.
- VAREJO estático: até 3 produtos. SERVIÇOS/MARCA estático: 0 produtos.
- Carrossel: todos os segmentos aceitam produtos (até 5).

### Impersonação (admin)
`useImpersonation` + `startImpersonation/stopImpersonation` — admin vê e atua como qualquer usuário. Usa `effectiveUserId` em vez de `userId` em todo código de dados.
- Brand kit: `loadKitServer` com `rpc("has_role")`
- Image kit: `loadImageKitFor` com `rpc("has_role")`
- Formulários: `form-owner` detecta troca de usuário no mount

### Planos e billing
`usePlan` + `debit_usage` (Supabase RPC) — limites por slot (MOP S3V/S6V/S9V + PU). Admin não tem bypass. Cada geração debita do plano.

## Regras de desenvolvimento
- **Deploy:** sempre `npm run deploy` (nunca só build ou só wrangler)
- **Commits:** português, descritivos, com Co-Authored-By
- **TypeScript:** sem `any` explícito onde possível; erros de build bloqueiam deploy
- **localStorage:** chaves sempre escopadas por `userId` exceto form (usa `form-owner` para detectar troca)
- **Supabase admin:** usar `supabaseAdmin` (service role) para operações que bypassam RLS
- **Cloudflare Workers:** sem `fs`, sem `path`, sem APIs Node.js nativas

## Processo obrigatório para refactor/melhoria estrutural
**Leia `PLANO_V2.md` (Seção 5 — Regras de Convenção, Seção 6 — Processo de Execução)
antes de qualquer extração de componente/hook, fatiamento de arquivo, unificação de
lógica duplicada ou reorganização estrutural.** Isso vale para qualquer sessão, não só
a que consolidou o processo — não é um plano descartável, é o padrão vigente do projeto.
Resumo do que a Seção 6 exige (não pule nenhum item):
1. Ler o arquivo/módulo inteiro antes de propor o corte; escrever o conteúdo dos
   arquivos novos pessoalmente em extrações mecânicas (sem ambiguidade) antes de
   delegar a fiação a um agente Opus 4.8 com prompt exaustivo.
2. Extração mecânica = zero mudança de lógica/texto/comportamento. Mudança de
   comportamento é uma tarefa separada, declarada como tal.
3. Antes de commitar: `tsc --noEmit`, `eslint` nos arquivos tocados, `vitest run`,
   `npm run build`, revisão do `git diff` linha a linha, e teste ao vivo (sessão real
   via Playwright) sempre que o fluxo não custar dinheiro real (geração de IA).
4. Deploy só depois de tudo verde: `npm run deploy` + smoke test em produção real.
5. Documentar antes/depois de linhas, commit e achados reais na memória do projeto.
6. **Ao final, invocar o Agente de Conformidade Estrutural**
   (`.claude/agents/conformidade-estrutural.md`) para auditar a mudança contra este
   processo — não é opcional, é o portão de saída da tarefa.

## Idioma
Todas as respostas e comentários de código em **português brasileiro**.
