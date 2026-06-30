# Método OP — Instruções do Projeto

## Stack técnica
- **Runtime:** Cloudflare Workers (edge, sem Node.js nativo)
- **Framework:** TanStack Start (React + TanStack Router, file-based routes)
- **Build:** Vite + @cloudflare/vite-plugin
- **Banco de dados:** Supabase (PostgreSQL, RLS, Storage)
- **Geração de texto:** OpenAI GPT-4.1
- **Geração de imagem:** fal.ai (flux)
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
    organizeMethodEngine.ts   # motor de geração MOP
    visualDirection.ts        # regras de imagem (hierarquia produto/personagem)
    referenciasPolicy.ts      # policy de referências por segmento/formato
    personalizacaoMop.ts      # slots e formatos (S3V, S6V, S9V, carrossel, reels)
  services/
    postUnico.ts              # motor de geração PU
    regenerateWithKit.ts      # regen MOP com Kit Imagem
    brandKit.ts               # CRUD do Kit de Marca (Supabase)
    api.ts                    # chamadas OpenAI e fal.ai
  lib/
    imageKit.functions.ts     # server functions Kit Imagem (Supabase Storage)
    kit.functions.ts          # server functions Kit de Marca
  hooks/
    useAuth.ts                # autenticação Supabase
    useImpersonation.ts       # modo admin "Atuar como"
    usePlan.ts                # planos e limites de uso
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

## Idioma
Todas as respostas e comentários de código em **português brasileiro**.
