# Método OP — Especificação Técnica do Projeto

> Versão: 2026-06-30 · Base: commit 891f0e3 (pós Fase 1 da refatoração v2)

---

## 1. Visão geral do produto

O Método OP é uma plataforma SaaS de geração de conteúdo para redes sociais, com dois modos de produção:

- **MOP (Método OP)** — sequências narrativas de 3, 6 ou 9 peças (carrossel, reels, estático, estático final) organizadas em "dias" de publicação.
- **PU (Post Único)** — peça avulsa com objetivo editorial específico, gerada independente de uma sequência.

A IA (GPT-4.1) gera texto; a IA de imagem (fal.ai flux) gera visuais baseados nas referências do Kit Imagem do usuário. O usuário edita e publica. O plano contratado define quantas peças com imagem o usuário pode gerar por mês.

---

## 2. Stack técnica

| Camada | Tecnologia |
|---|---|
| Runtime | Cloudflare Workers (edge, sem Node.js nativo) |
| Framework | TanStack Start (React 18 + TanStack Router, file-based routes) |
| Build | Vite + `@cloudflare/vite-plugin` |
| Banco de dados | Supabase (PostgreSQL, RLS, Storage) |
| Geração de texto | OpenAI GPT-4.1 |
| Geração de imagem | fal.ai (flux) |
| Áudio/narração | ElevenLabs |
| Deploy | `npm run deploy` → `vite build` + `wrangler deploy` |
| Linguagem | TypeScript (strict), React 18, Tailwind CSS |

**Restrições do ambiente:**
- Sem `fs`, `path` ou qualquer API Node.js nativa (Cloudflare Workers).
- Sem `window` no servidor — todo código isomórfico precisa de guard `typeof window !== "undefined"`.
- `createServerFn` (TanStack) é o único mecanismo de código server-side no Workers.

---

## 3. Conceitos de negócio

### 3.1 Segmentos

| Segmento | Hierarquia visual | Produto no estático/final |
|---|---|---|
| **VAREJO** | Produto é herói | Sim (até 3) |
| **SERVIÇOS** | Personagem é protagonista | Não |
| **MARCA** | 50/50 produto×personagem (ou personagem domina se marca pessoal) | Não |

`isPersonalBrand` no BrandKit muda a hierarquia do segmento MARCA: personagem domina (artista, coach, influenciador, terapeuta). Sem efeito fora de MARCA.

### 3.2 Trilhas MOP (`Track`)

| Track | Peça de fechamento | Modelo |
|---|---|---|
| `cinematica` | Reels | S3C / S6C / S9C |
| `visual` | Estático Final | S3V / S6V / S9V |
| `experimentacao` | Estático Final (sequência reduzida de 2 períodos) | EXP |

### 3.3 Modelos

```
ModeloOP = "EXP" | "PU2" | "PU4" | "PU8" | "S3V" | "S6V" | "S9V" | "S3C" | "S6C" | "S9C"
```

Resolvido por `resolveModelo(track, sequenceSize)` em `personalizacaoMop.ts`.

### 3.4 Mood (Direção Visual Dominante)

6 moods internos governam a gramática visual de toda a sequência. **Nunca expor os nomes internos ao usuário.**

| Código | Nome interno | Tensão Dondis |
|---|---|---|
| OP-01 | CLAREZA | Equilíbrio + Simetria + Regularidade |
| OP-02 | IMPACTO | Audácia + Ênfase + Acento + Instabilidade controlada |
| OP-03 | INSTANTE | Espontaneidade + Acaso + Atividade + Episodicidade |
| OP-04 | DESVIO | Instabilidade + Assimetria + Complexidade + Distorção |
| OP-05 | SILÊNCIO | Sutileza + Harmonia + Passividade + Simplicidade |
| OP-06 | CALOR | Profundidade + Textura + Organicidade + Saturação quente |

Definidos em `src/core/visualDirection.ts` (dados internos + builders de prompt).

### 3.5 Públicos e Momentos

- **Audience:** `"B2C"` | `"B2B"` — direciona vocabulário e CTA (B2B proíbe urgência agressiva e CTA de consumidor final).
- **BusinessMoment:** `"lançamento"` | `"consolidação"` | `"reativação"` — modifica o `entryModifier` do primeiro dia da sequência (DESCOBERTA / ENTENDIMENTO / RECONEXÃO).
- **FaixaEtaria:** `"18-34"` | `"35-49"` | `"50-65"` — direciona registro e vocabulário do título/texto.

### 3.6 Objetivos do Post Único

```
PostUnicoObjetivo = "promocao" | "homenagem" | "aviso" | "oportunidade"
                  | "institucional" | "fatos" | "venda" | "nenhum"
```

- **Fatos** e **Venda**: usam fotos reais do Kit Imagem (slots `fato`/`venda`) com aplicação direta — a IA não reinventa, só aplica overlay de marca/copy.
- **Promocao** e **Oportunidade**: título sem palavras de urgência artificial ("hoje/agora/já/última chance" etc.).

### 3.7 Policy de Referências Visuais

Definida em `src/core/referenciasPolicy.ts`. Governa quantas imagens do Kit Imagem são permitidas por formato/segmento.

| Formato | Avatar | Fachada | Cenários | Produtos |
|---|---|---|---|---|
| EXP | ✓ | ✓ | até 2 | até 5 |
| PU (2/4/8) | ✓ | ✓ | até 2 | até 3 |
| MOP estático / estático_final (VAREJO) | ✓ | ✓ | 1 | até 3 |
| MOP estático / estático_final (SERVIÇOS/MARCA) | ✓ | ✓ | 1 | 0 |
| MOP carrossel (todos) | ✗ | ✓ | 1 | até 5 |
| MOP reels (todos) | ✓ | ✓ | até 2 | 0 |

A fachada tem slot próprio no Kit Imagem, fora do pool de cenários.

---

## 4. Modelo de dados

### 4.1 BrandKit

```ts
interface BrandKit {
  companyName: string;
  segment: "SERVIÇOS" | "VAREJO" | "MARCA";
  logoDataUrl?: string;
  logoHasName: boolean;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  fontPair: FontPair;
  secondaryFont?: "fina" | "grossa";   // manuscrita — destaca 1 palavra do título
  brandVoice: string;
  mainActivity?: string;
  logoPosition?: "bottom-right" | "top-center" | "bottom-center";
  assinatura?: string;
  uniformeDataUrl?: string;            // foto do uniforme (plano médio, sem rosto)
  products?: string[];                 // mín. 3, máx. 10 — matéria-prima da Sugestão
  isPersonalBrand?: boolean;           // só tem efeito em segmento MARCA
}
```

Persistido no Supabase (tabela `brand_kits`). Cache local em `localStorage` escopado por `userId`.

### 4.2 ImageKit

```ts
interface ImageKit {
  avatar?: string;           // foto do responsável/dono (dataURL ou signed URL)
  avatar2?: string;          // segundo avatar opcional
  fachada?: string;          // frente do estabelecimento
  cenarios: (string | null)[];   // tamanho fixo 2 (não reorganiza ao apagar)
  produtos: (string | null)[];   // tamanho fixo 8 (não reorganiza ao apagar)
  fato?: string;             // foto de evento/acontecimento — objetivo Fatos na PU
  venda?: string;            // foto de colaborador com produto — objetivo Venda na PU
}
```

Persistido no Supabase Storage (bucket `image-kits`). Cache local em `localStorage` como `IMAGE_KIT_KEY:userId`. Signed URLs têm TTL de 1h.

### 4.3 ContentFormData (formulário MOP)

```ts
interface ContentFormData {
  companyName: string;
  segment: Segment;
  audience: "B2C" | "B2B";
  businessMoment: "lançamento" | "consolidação" | "reativação";
  keyInfo?: string;           // informação-chave / produto concreto — semente da Sugestão
  brandVoice: string;
  outputMode: "feed" | "stories" | "feed+stories";
  sequenceSize: 3 | 6 | 9;
  storiesDays: 1 | 2 | 3 | 4 | 5;
  storiesQuantity: 3 | 6;
  outputFormats: OutputFormat[];
  track?: Track;
  mainActivity?: string;
  mood: MoodCode;
  faixaEtaria?: "18-34" | "35-49" | "50-65" | null;
  generoPref?: "M" | "F" | null;
}
```

### 4.4 PostUnicoFormData

```ts
interface PostUnicoFormData {
  companyName: string;
  mainActivity: string;
  audience: "B2C" | "B2B";
  keyInfo: string;
  objetivo: PostUnicoObjetivo;
  direcao: "livre" | "mood";
  mood?: MoodCode;
  faixaEtaria?: "18-34" | "35-49" | "50-65" | null;
  generoPref?: "M" | "F" | null;
}
```

### 4.5 MethodOpResult

```ts
interface MethodOpResult {
  feed?: FeedItem[];           // peças do feed (Estático, Carrossel, Reels, Estático Final)
  carousel?: CarouselCard[];   // cards internos do carrossel
  reels?: ReelsGuide[];        // guia do reels (hook + script + imagePrompt)
  stories?: StoriesSequence[]; // sequências de stories
  raw?: unknown;               // resposta bruta da IA (debug)
  summary?: GenerationSummary; // contagem de peças geradas
  flags?: ValidationFlag[];    // reprovações heurísticas pós-geração (D1)
  ancora_visual?: AnchoraVisual; // ancoragem de gênero/idade/papel do personagem
}
```

### 4.6 AnchoraVisual

```ts
interface AnchoraVisual {
  genero: "M" | "F";
  papel: "protagonista" | "contexto_de_uso" | "publico_alvo";
  // "publico_alvo" = receptor da comunicação (SERVIÇOS, MARCA)
  // "contexto_de_uso" = complementa o produto (VAREJO)
  // "protagonista" = legado, não emitido mais (compatibilidade com resultados antigos)
  faixa_etaria: string;
  marcadores_profissionais: string;
  ambiente_base: string;
}
```

### 4.7 PostUnicoVisualSelection

```ts
interface PostUnicoVisualSelection {
  useAvatar: boolean;
  avatarSelecionado: 1 | 2;
  useFachada?: boolean;
  useCenario: boolean;
  useProdutos: boolean;
  produtosSelecionados: number[];   // números 1..8
  cenarioSelecionado: number | null;
  useUniforme: boolean;
  personagemSemAvatar?: {
    ativo: boolean;
    genero: "mulher" | "homem";
    idade: string;
    comUniforme?: boolean;
  };
  useFato?: boolean;
  useVenda?: boolean;
  produtoTelaInformativa?: boolean; // suspende desfoque de tela para produto-dispositivo
}
```

---

## 5. Arquitetura atual (pós Fase 1)

```
src/
  MetodoOpApp.tsx            # componente raiz (~1374 linhas) — god component
  routes/                    # TanStack file-based (/app, /historico, /conta, /admin)
  components/
    metodo-op/               # MOP e PU (ContentForm, PostUnicoForm, ResultsView, etc.)
    admin/                   # painel admin (UsersTab, CobrancasTab, CustosTab, etc.)
  core/
    organizeMethodEngine.ts  # motor de geração MOP (builder de prompt + normalização)
    visualDirection.ts       # léxico visual por Mood × Segmento
    referenciasPolicy.ts     # policy de imagens por formato/segmento
    personalizacaoMop.ts     # tipos ModeloOP/SlotFormato + computeCota
  services/
    postUnico.ts             # motor PU (prompt + geração + judge)
    regenerateWithKit.ts     # regen MOP com Kit Imagem (buildReferences)
    api.ts                   # chamadas OpenAI e fal.ai (generateCaption, generateImage)
    brandKit.ts              # CRUD Kit de Marca (Supabase)
    judgeContent.ts          # judge LLM pós-geração
    autoRegenerate.ts        # orquestração de regen automático (E3)
    regenerateBlock.ts       # regen pontual de um bloco (E4)
    imageGeneration.ts       # geração de imagem por peça
    textCorrection.ts        # correção ortográfica pós-geração
    voiceClone.ts            # clone de voz ElevenLabs
  lib/
    storage/
      keys.ts                # ← NOVO (Fase 1) — catálogo de todas as chaves
      store.ts               # ← NOVO (Fase 1) — ÚNICO ponto de acesso ao localStorage
    imageKit.functions.ts    # server functions Kit Imagem (Supabase Storage)
    kit.functions.ts         # server functions Kit de Marca
  hooks/
    useAuth.ts               # autenticação Supabase
    useImpersonation.ts      # modo admin "Atuar como"
    usePlan.ts               # planos e limites de uso
    useProfile.ts            # perfil do usuário com planos/cotas
  utils/
    storage.ts               # saveKit/loadKit/saveForm/loadForm/clearStorage (scoped por userId)
    sessionImageCache.ts     # cache de imagens MOP em memória + localStorage
    imageKitStorage.ts       # cache local do Kit Imagem + sync com Supabase
    copyEditsStorage.ts      # persistência de edições manuais de copy (scoped por userId)
  types.ts                   # interfaces principais
```

---

## 6. Camada de storage (pós Fase 1)

### 6.1 Módulos

**`src/lib/storage/keys.ts`** — catálogo de constantes de chave. Nenhuma lógica, apenas exportações.

```ts
DARK_MODE_KEY        = "metodo-op-dark-mode"
COOKIE_CONSENT_KEY   = "mop.cookie-consent"
IMPERSONATION_KEY    = "impersonation-v1"
MODO_KEY             = "metodo-op-modo"
MOOD_KEY             = "metodo-op-mood"
KIT_KEY              = "metodo-op-kit-v1"
LOGO_KEY             = "metodo-op-logo-v1"
FORM_KEY             = "metodo-op-form-v1"
POSTUNICO_FORM_KEY   = "metodo-op-postunico-v2"
RESULT_KEY           = "metodo-op-result-v1"
PU_IMG_KEY           = "metodo-op-postunico-img-v1"
PU_CAPTION_KEY       = "metodo-op-postunico-caption-v1"
PU_STARTED_KEY       = "metodo-op-postunico-started-v1"
PU_VISUAL_KEY        = "metodo-op-postunico-visualselection-v1"
IMAGE_KIT_KEY        = "metodo-op-image-kit-v1"
COPY_EDITS_KEY       = "metodo-op-copyedits-v1"
SESSION_IMG_PREFIX   = "metodo-op-img-v1"
MODO_INIT_KEY        = "metodo-op-modo-init-v1"  // sessionStorage
```

**`src/lib/storage/store.ts`** — **único arquivo** do projeto com `localStorage.xxx` direto.

| Função | Assinatura | Uso |
|---|---|---|
| `lsGet` | `(base, userId?) → string\|null` | Lê `base:userId` (ou `base` sem userId) |
| `lsSet` | `(base, value, userId?)` | Grava; ignora QuotaExceededError silenciosamente |
| `lsRemove` | `(base, userId?)` | Remove a chave escopada |
| `lsSetQuotaSafe` | `(base, value, userId?)` | Grava; ao falhar quota libera cache do Kit Imagem e tenta novamente |
| `lsGetRaw` | `(key) → string\|null` | Lê chave literal (sem escopo) |
| `lsSetRaw` | `(key, value)` | Grava chave literal; ignora erros |
| `lsRemoveRaw` | `(key)` | Remove chave literal |
| `lsSetRawOrThrow` | `(key, value)` | Grava chave literal; **propaga QuotaExceededError** — uso exclusivo de imageKitStorage |
| `lsClearPrefix` | `(prefix)` | Remove todas as chaves com o prefixo |
| `lsClearUser` | `(userId)` | Remove todas as chaves que contêm `:userId` |
| `ssGet/ssSet/ssClearPrefix` | — | Acesso ao sessionStorage |

### 6.2 Convenção de escopo

- **Chaves escopadas por userId** (dado sensível, muda por conta): `base:userId`
  - FORM, KIT, LOGO, POSTUNICO_FORM, RESULT, PU_IMG, PU_CAPTION, PU_STARTED, PU_VISUAL, COPY_EDITS, IMAGE_KIT
- **Chaves globais** (preferência de UI, sem risco de vazamento): chave literal
  - DARK_MODE, COOKIE_CONSENT, IMPERSONATION, MODO, MOOD
- **Chaves compostas** (cache de imagens MOP): `SESSION_IMG_PREFIX:userId:cardKey`
  - Não seguem o padrão `base:userId`; acessadas via `lsGetRaw/lsSetRaw` com a chave completa pré-montada
- **sessionStorage** (flags temporárias de sessão): `MODO_INIT_KEY:userId`
  - Limpo em `signOut()` via `ssClearPrefix`

### 6.3 Regra inviolável

> Zero `localStorage.setItem/getItem/removeItem` literal fora de `src/lib/storage/store.ts`.
> Todo novo campo persistido nasce em `keys.ts` e acessa via `store.ts`.

---

## 7. Pipeline de geração

### 7.1 MOP

```
ContentForm (formulário) →
  MetodoOpApp.handleGenerate →
    [checkBalance] → debit_usage (Supabase RPC) →
    buildMetodoOpPrompt (organizeMethodEngine.ts) →
    OpenAI GPT-4.1 (api.ts generateContent) →
    normalizeMethodResult →
    [flagging D1] autoRegenerate / regenerateBlock →
    setResult (state) → persistência localStorage
```

**Prompt MOP:** Construído por `buildMetodoOpPrompt` com blocos de:
- Perfil da empresa (segmento, atividade, voz da marca, kit de produtos)
- Direção de audiência (B2C/B2B + faixa etária)
- Progressão narrativa por segmento/mood (IDENTIFICAÇÃO → ENTENDIMENTO → AGIR etc.)
- Âncora visual (gênero, papel do personagem, faixa etária — determinístico por `sessionSeed`)
- Bloco FORMA DE FRASE (B+) e Medida D (venda só no fechamento)
- Regras de título (5 palavras, piso/teto 30-45%, sem urgência em promo/oportunidade)
- Regras de legenda (corpo ≤ 35 palavras, CTA ≤ 5 palavras, 3 hashtags)

### 7.2 PU

```
PostUnicoForm (formulário) →
  MetodoOpApp.handleGeneratePostUnico →
    [checkBalance] → debit_usage →
    buildPostUnicoPrompt (postUnico.ts) →
    OpenAI GPT-4.1 (api.ts) →
    [E3 autoRegenerateFlaggedPostUnico] →
    [D2 judgeAndRegeneratePostUnico] →
    setPostUnicoImg (geração de imagem) →
    persistência localStorage
```

**Imagem PU/MOP:** Prompt de imagem construído com referências do Kit Imagem via `buildReferences` (`regenerateWithKit.ts`) + blocos de ancoragem visual (`buildAnchorPrefix`). Gerado por `fal.ai flux` via `generateImage` em `api.ts`.

### 7.3 Regen pontual (Kit Imagem)

```
UsoReferenciasDia / PostUnicoComposicaoVisual →
  [seleção de imagens] →
  regenerateWithKit / postUnico regenerar com kit →
    buildReferences (monta PostUnicoReferences) →
    buildAnchorPrefix (bloco textual de referências) →
    fal.ai flux
```

### 7.4 Sistema de Judge (qualidade)

- **D1 (flags heurísticas):** checagens síncronas pós-geração (palavras proibidas, urgência, tamanho). Resultado armazenado em `flags[]` do `MethodOpResult`. Acionam regen automático (E3).
- **D2 (judge LLM):** GPT-4.1 avalia copy pós-geração. `judgeContent.ts` / `judgeAndRegeneratePostUnico`. Baixa prioridade — aguardando dados de produção.
- **E3 (auto-regen):** `autoRegenerate.ts` — refaz blocos com flags D1, retry + fallback.
- **E4 (regen limpo):** `regenerateBlock.ts` — regen manual de 1 bloco específico sem D1.

---

## 8. Autenticação e autorização

### 8.1 Auth

- Supabase Auth (email/senha, sem confirmação de email visível ao usuário).
- `useAuth.ts` — estado de sessão + `signOut()` (limpa localStorage escopado por userId).
- `AuthGate` — bloqueia a UI durante loading de sessão; redireciona para `/login` sem sessão.

### 8.2 Impersonação (admin)

- `useImpersonation.ts` — `startImpersonation(userId)` / `stopImpersonation()`.
- Persistido em `IMPERSONATION_KEY` (global, não escopado por userId).
- `effectiveUserId` = `impersonation?.userId || user?.id` — usado em **todo** acesso a dados.
- Kit de Marca e Kit Imagem carregam via `rpc("has_role")` para bypassar RLS quando em impersonação.
- `form-owner` heuristic **removida** na Fase 1 — form carrega diretamente por `effectiveUserId`.

### 8.3 Admin check

**Via RPC (correto):** `rpc("has_role", { _user_id, _role: "admin" })` — usado em `imageKit.functions.ts`, `brandKit.ts`, `assets.functions.ts`, `usage.server.ts`.

**Via tabela (problemático, Problema 4 do diagnóstico):** `from("user_roles").eq("role","admin")` — ainda presente em `migrateImageKitFor`, `users.functions.ts`, `storageStats.functions.ts`, `testUsers.functions.ts`, `planHistory.functions.ts`. Será unificado na Fase 6.

### 8.4 RLS e supabaseAdmin

- `supabase` (cliente anon) — acessa dados do próprio usuário autenticado via RLS.
- `supabaseAdmin` (service role) — bypassa RLS para operações admin (impersonação, migração). Nunca expor ao cliente.

---

## 9. Billing e planos

### 9.1 Slots de plano

Cada usuário tem até 3 planos simultâneos: P1 (principal), P2 (secundário), Bônus. Cada plano define `base_estatico`, `base_carrossel`, `base_estatico_final`, `base_reels`. Extras podem ser adicionados por admin.

Cotas computadas por `computeCota(entries)` em `personalizacaoMop.ts`.

### 9.2 Débito

`debit_usage(userId, slotType)` — RPC Supabase. Debita 1 unidade do slot ativo no momento da geração. Admins **não têm bypass** desde 2026-06-06.

`checkBalance(userId)` — RPC que verifica se há saldo antes de gerar.

### 9.3 Slot ativo (`selectedSlot`)

Determinado em `MetodoOpApp` a partir do `usePlan` / `useProfile` — escolhe automaticamente o slot com menor saldo restante (para consumir pela ordem correta). Exposto na UI como indicador de saldo.

---

## 10. Regras de geração de conteúdo

### 10.1 Títulos

- Máximo 5 palavras (sincronizado entre prompt e pós-processamento).
- Sem corte cego; piso 30%, teto 45% da largura do card (pós-processamento via E3/E4).
- `promocao` e `oportunidade`: sem palavras de urgência ("hoje/agora/já/última chance" etc.).
- Manuscrita (`secondaryFont`): nunca na 1ª palavra; pode ser fechamento/assunto/benefício; rotação determinística por título; máx. 8 letras.

### 10.2 Legendas

- Corpo ≤ 35 palavras.
- CTA ≤ 5 palavras.
- Exatamente 3 hashtags.
- Palavras proibidas (ex.: "incrível", "transformar") filtradas em pós-processamento.

### 10.3 Âncora visual

- **Determinística por `sessionSeed`** — gênero/papel/faixa etária sorteados uma vez por geração e mantidos consistentes entre as 9 peças.
- Balanceamento entre peças: não repete o mesmo gênero em sequência para mesma posição.
- `forcedGender` via formulário (`generoPref`) tem prioridade sobre o sorteio.
- `faixaEtaria` do formulário tem prioridade sobre faixa interna.

### 10.4 Sugestão (informação-chave)

- Mínimo 4 palavras, máximo 10.
- 15 lentes internas (sem expor "Método OP" ou termos internos ao usuário).
- `pickConcreteItem` usa `sessionSeed + suggestCount` como semente para variar produto entre sessões.
- Kit de Marca exige ≥ 3 produtos para a Sugestão funcionar (checklist na UI).

### 10.5 Venda / Medida D

- Peça de venda (preço/oferta) só no **último conteúdo** da sequência (fechamento).
- PU com objetivo `venda` não tem essa restrição (é o objetivo da peça inteira).

### 10.6 Produto no carrossel

- VAREJO: distribuição determinística — 1ª/última peça = produto inteiro; meio = detalhe/recorte.
- Somente fotos selecionadas pelo usuário no Kit Imagem (sem mix automático).

---

## 11. Rotas da aplicação

| Rota | Componente principal |
|---|---|
| `/` | Landing + cookie consent |
| `/login` | Formulário de login |
| `/signup` | Formulário de cadastro |
| `/app` | `MetodoOpApp` (MOP + PU + Kit) |
| `/historico` | Histórico de geração |
| `/conta` | Perfil do usuário |
| `/admin` | Painel admin (users, cobranças, custos, storage) |

---

## 12. Variáveis de ambiente

Todas via Cloudflare Workers Secrets / `wrangler.toml` (nunca em `.env` commitado):

| Var | Uso |
|---|---|
| `OPENAI_API_KEY` | GPT-4.1 |
| `FAL_KEY` | fal.ai flux |
| `ELEVENLABS_API_KEY` | ElevenLabs |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Cliente público |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabaseAdmin` (bypassa RLS) |

Variáveis de cliente (prefixo `VITE_`) são compiladas no bundle:

| Var | Uso |
|---|---|
| `VITE_SUPABASE_URL` | Cliente-side Supabase |
| `VITE_SUPABASE_ANON_KEY` | Cliente-side Supabase |

---

## 13. Supabase — estrutura relevante

| Tabela / RPC | Responsabilidade |
|---|---|
| `profiles` | Dados do usuário (nome, email, plano) |
| `brand_kits` | Kit de Marca por usuário |
| `user_plans` / `user_plans_2` / `user_bonus_plans` | Planos P1/P2/Bônus |
| `usage_records` | Histórico de débito por slot |
| `user_roles` | `role = "admin"` |
| `rpc("has_role")` | Verificação de admin (via RLS, correto) |
| `rpc("debit_usage")` | Débito atômico de 1 unidade do slot ativo |
| `rpc("check_balance")` | Saldo disponível antes de gerar |
| Storage bucket `image-kits` | Kit Imagem (signed URLs, TTL 1h) |

---

## 14. Roadmap de refatoração (PLANO_V2.md)

### Status por fase

| Fase | Descrição | Status |
|---|---|---|
| **0** | Rede de segurança — 69 testes Vitest | ✅ Concluída (commit 412d8b9) |
| **1** | Centralizar localStorage — `lib/storage/keys.ts` + `store.ts` | ✅ Concluída (commit 891f0e3) |
| **2** | Unificar tipos de domínio | 🔜 Próxima |
| **3** | Unificar builder de referências visuais | ⬜ Pendente |
| **4** | Extrair hooks de geração e persistência | ⬜ Pendente |
| **5** | Providers de Context | ⬜ Pendente |
| **6** | Camada repository + unificação do admin check | ⬜ Pendente |
| **7** | Adotar shadcn/ui + unificar sistema de estilos | ⬜ Pendente |
| **8** | Fatiar megafiles | ⬜ Pendente |

### Fase 2 — Unificação de tipos (próxima)

**O que fazer:**
1. Criar `src/domain/visualSelection.ts` com `SelecaoDireta` + `PersonagemSemAvatar` (hoje declaradas 3×).
2. Criar `src/domain/segment.ts`, `src/domain/mood.ts`, `src/domain/objetivo.ts` como tipos canônicos.
3. Fazer `RegenerateInput`, `buildReferences` e `PostUnicoVisualSelection` importar de `domain/`.
4. Extrair tabelas de configuração para `*.config.ts`: `AUDIENCE_SEGMENT_CONFIG`, `OBJETIVO_*`, `VISUAL_DIRECTIONS`.

**Critério de conclusão:** Build TypeScript passa. Uma só definição de cada shape; zero redeclaração inline.

**Risco:** Baixo — refatoração guiada pelo compilador.

---

## 15. Convenções de código (v2.0)

1. **`localStorage` só via `lib/storage`** — zero acesso direto em componentes/hooks/services.
2. **Um shape, uma definição** — tipos de domínio vivem em `domain/` e são importados de lá.
3. **Engines são puras** — sem React, Supabase ou localStorage; recebem tudo por parâmetro.
4. **Dados separados de lógica** — tabelas de configuração em `*.config.ts` ou `*.lexicon.ts`.
5. **Supabase só em `repository/` e `server/`** (meta da Fase 6 — ainda não aplicado).
6. **Admin check via `rpc("has_role")`** — proibido `from("user_roles").eq("role","admin")` fora do repositório.
7. **Estado global via Context** — prop drilling de mais de 2 níveis vira Context.
8. **`window.confirm` e `alert()` proibidos** — usar `useConfirm()` + dialog (meta da Fase 7).
9. **Toda regra nova nas engines entra com teste de snapshot** (Fase 0 como base).
10. **Deploy:** sempre `npm run deploy` (nunca só build ou só wrangler).
11. **Commits:** português, descritivos, com `Co-Authored-By: Claude Sonnet 4.6`.
12. **Sem comentários** exceto quando o "por quê" é não-óbvio (invariante oculta, contorno de bug específico).
