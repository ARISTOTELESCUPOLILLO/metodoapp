# PLANO_V2.md — Método OP · Plano de Refatoração v2.0

> Gerado por 4 agentes Opus 4.8 em paralelo + síntese · 2026-06-30
> Agente 1: Análise de Sistemas | Agente 2: Banco de Dados | Agente 3: Componentes | Agente 4: Engenharia

---

## 1. DIAGNÓSTICO — Os 5 maiores problemas

### Problema 1 — Dois pipelines de prompt paralelos com sincronização manual

O projeto tem duas engines de geração de imagem que constroem os mesmos blocos de instrução textual de forma independente: `services/postUnico.ts` para PU (função `referencesBlock`, linhas 502–701) e `services/regenerateWithKit.ts` para MOP (função `buildAnchorPrefix`, linhas 250–428). Ambas produzem instruções quase idênticas para FACHADA, CENÁRIO, PRODUTOS, FUNDO NEUTRO, REGRA DE CONTAGEM e ÚLTIMA VERIFICAÇÃO — mas em código separado.

Exemplos concretos de duplicação textual: o trecho "FUNDO NEUTRO OBRIGATÓRIO" em `postUnico.ts:681-687` espelha `regenerateWithKit.ts:407-413`; "REGRA DE CONTAGEM — INEGOCIÁVEL" em `postUnico.ts:666-668` e `regenerateWithKit.ts:398-400`. O texto de `referenceAnchorBlock` está **triplicado literalmente** em `postUnico.ts:831`, `api.ts:298-299` e `api.ts:590-591`.

Consequência direta: toda correção visual precisa ser aplicada duas vezes, e a divergência entre as cópias é a fonte recorrente de bugs. O histórico do projeto registra dezenas de fixes aplicados em pares ("MOP+PU") — fundo do avatar, produto em estático VAREJO-only, traço da manuscrita, gênero, urgência de título. Cada um desses bugs existiu exatamente porque a segunda cópia não foi atualizada.

**Alavanca máxima:** unificar `referencesBlock` e `buildAnchorPrefix` num único builder em `shared/visual/buildAnchorPrefix.ts`, consumido por ambos os motores.

---

### Problema 2 — God components com estado de negócio na raiz da UI

`MetodoOpApp.tsx` (1374 linhas) concentra ~28 `useState` e 16 `useEffect` cobrindo domínios completamente distintos: modo/navegação (linha 167), kit de marca (177), kit de imagem (178), formulário MOP (195), formulário PU com 10 estados próprios (199–218), roteamento de slot de cobrança (260–342), persistência manual de 5 chaves de localStorage (363–559) e orquestração de geração da PU (`handleGeneratePostUnico`, 800–934, 134 linhas).

O próprio código admite a dívida: os comentários nas linhas 203–218 explicam que `puTituloRegen`, `puTextoRegen`, `puCaptionRegen`, `puCopy` e `puCopyOriginal` foram **içados para o componente raiz** porque zeravam ao trocar de aba. Isso é sintoma, não solução: o estado da PU foi empurrado para cima em vez de ser isolado num hook/contexto dedicado.

`ResultsView.tsx` (3805 linhas, 68 `useState`, 9 componentes no mesmo arquivo) é ainda mais grave: os quatro cards (FeedCard ~641, FinalCard ~955, CarouselCardBlock ~1295, ReelsCard ~2016) repetem a mesma tríade `updatePreview/handleGenerate/handleGenerateWithRefs` em cada bloco, com lógica de débito, regeneração e edição misturada com layout.

Consequência: qualquer mudança no root toca 1374 linhas e pode afetar MOP, PU, billing, persistência e kit ao mesmo tempo. Os bugs de remontagem/impersonação registrados no histórico (modo trocando sozinho, audience resetando, contadores zerando, copy perdido ao voltar de rota) derivam diretamente desse design.

---

### Problema 3 — Chaves de localStorage fragmentadas e sem escopo central

As mesmas strings `metodo-op-result-v1:${userId}`, `metodo-op-postunico-img-v1:`, `metodo-op-postunico-caption-v1:`, `metodo-op-postunico-started-v1:`, `metodo-op-postunico-visualselection-v1:` aparecem em três arquivos diferentes: escrita em `MetodoOpApp.tsx` (linhas 463–491, 509–559), limpeza em `useAuth.ts` `signOut()` (linhas 41–45) e o prefixo `metodo-op-modo-init-v1:` em dois lugares separados.

O formulário MOP usa `metodo-op-form-v1` **sem escopo de userId** (storage.ts:2), dependendo de `form-owner` como heurística de detecção de troca (storage.ts:4-5). As URLs assinadas do Supabase Storage (TTL de 1h) são persistidas no localStorage por `saveImageKit` e tratadas por `slotPayload` (imageKitStorage.ts:202) como "já existe, não reenvia" — uma URL expirada (403) é indistinguível de uma válida pelo código de diff.

Adicionar um campo persistido exige editar manualmente leitura, escrita e limpeza em arquivos diferentes. Esquecer um lado vaza dado entre usuários ou entre sessões de impersonação — exatamente o histórico de bugs `form-owner`/`modo-init`/`audience-impersonation-reset`.

---

### Problema 4 — Duas implementações de verificação de admin convivendo

A verificação de permissão admin tem **duas implementações paralelas** no mesmo projeto:

- Via RPC (correta): `rpc("has_role", {_user_id, _role:"admin"})` — usada em `imageKit.functions.ts:86,336`, `brandKit.ts:41,86`, `assets.functions.ts:37`, `usage.server.ts:37,54`.
- Via tabela (problemática): `from("user_roles").select("role").eq("user_id",…).eq("role","admin")` — usada em `imageKit.functions.ts:160` (`migrateImageKitFor`), `users.functions.ts:14,50`, `storageStats.functions.ts:10`, `testUsers.functions.ts:13`, `planHistory.functions.ts:11`.

O comentário em `imageKit.functions.ts:82-84` reconhece que o caminho por tabela tinha "fallback silencioso" que era bug — mas `migrateImageKitFor` **no mesmo arquivo** ainda usa o caminho por tabela. Essa divergência foi a causa da vulnerabilidade de JWT registrada (`project-ajuste-conflito-bugs-fix`, commit abb8043). A verificação via `as never` (`rpc("has_role" as never, {...} as never)`) desliga a checagem de tipos exatamente no ponto de decisão de segurança.

Além disso, a lógica de cota/slot está triplicada: mapeamento de `SlotInfo` em `useProfile.ts:183–221`, cálculo inline em `MetodoOpApp.tsx:249–338` e RPCs em `usage.server.ts:124–207` — sem uma camada de billing unificada.

---

### Problema 5 — Design system instalado, completamente ignorado

Existem **40 componentes shadcn/ui** em `src/components/ui/` (button, dialog, card, table, input, badge, tabs, alert-dialog, skeleton, etc.), mas **apenas `sheet.tsx` é importado** — e só por 2 arquivos (`ContentForm.tsx:5`, `PostUnicoForm.tsx:20`). Os outros 39 são código morto.

Enquanto isso, o app inteiro reimplementa os mesmos elementos com 4 sistemas de estilo colidindo:
- Estilo inline com hex hardcoded: `#f4b000` (13× em `components`), `#0f213f`, `#64748b` espalhados
- Tailwind com tokens shadcn (`bg-background`, `text-foreground`) — só nas rotas de auth
- Classes CSS em `metodo-op.css` (`appShell`, `hero`, `panel`, `spinner`)
- Classes utilitárias Tailwind

O padrão de confirmação destrutiva está triplicado: `ConfirmDialog` via `askConfirm` (MetodoOpApp), `window.confirm` nativo (20 ocorrências no admin), e `alert()` nativo (28 ocorrências em handlers). Abas de navegação são reimplementadas do zero em `admin.tsx:75-93`, `FinanceiroTab.tsx:16-45`, `ClientesFinanceiroTab`, `CustosTab`, `StorageTab`, `UsersTab` — cada uma com seu próprio `borderBottom: "2px solid #0f213f"`. O `ui/tabs.tsx` existe e não é usado.

---

## 2. ESTRUTURA DE PASTAS PROPOSTA (v2.0)

```
src/
│
├── app/                          # composição de telas, zero lógica de negócio
│   ├── AppShell.tsx              # ex-MetodoOpApp: layout + roteamento de modo
│   └── providers/
│       ├── SessionProvider.tsx   # auth + impersonação → effectiveUserId resolvido
│       ├── BrandKitProvider.tsx  # kit de marca
│       ├── ImageKitProvider.tsx  # kit de imagem
│       └── PlanProvider.tsx      # slots, cotas, slot de débito ativo
│
├── features/
│   ├── mop/                      # Método OP (sequências)
│   │   ├── components/
│   │   │   ├── ContentForm.tsx
│   │   │   ├── results/
│   │   │   │   ├── ResultsView.tsx        # orquestrador leve
│   │   │   │   ├── cards/
│   │   │   │   │   ├── FeedCard.tsx
│   │   │   │   │   ├── FinalCard.tsx
│   │   │   │   │   ├── CarouselCardBlock.tsx
│   │   │   │   │   ├── ReelsCard.tsx
│   │   │   │   │   └── StoriesBlock.tsx
│   │   │   │   └── EditableField.tsx      # extraído de ResultsView
│   │   │   └── UsoReferenciasDia.tsx
│   │   ├── hooks/
│   │   │   ├── useMopGeneration.ts        # ex-handleGenerate do root
│   │   │   ├── useCardGeneration.ts       # tríade update/generate/generateWithRefs
│   │   │   └── useAnchorControl.ts        # anchorGenderFlipped/anchorAgeOverride
│   │   ├── engine/
│   │   │   ├── buildMopPrompt.ts          # ex-organizaMethodEngine (só builder)
│   │   │   ├── normalizeMopResult.ts      # ex-normalizeMethodResult (só normalização)
│   │   │   ├── audienceSegment.config.ts  # AUDIENCE_SEGMENT_CONFIG
│   │   │   └── momentModulators.config.ts
│   │   └── mop.types.ts
│   │
│   ├── pu/                       # Post Único
│   │   ├── components/
│   │   │   ├── PostUnicoForm.tsx
│   │   │   ├── PostUnicoResult.tsx
│   │   │   └── PostUnicoComposicaoVisual.tsx
│   │   ├── hooks/
│   │   │   ├── usePostUnicoGeneration.ts  # ex-handleGeneratePostUnico do root
│   │   │   └── usePostUnicoCopy.ts        # sugestão + judge + regen de copy
│   │   ├── engine/
│   │   │   ├── buildPuPrompt.ts
│   │   │   └── objetivo.config.ts         # OBJETIVO_LABEL/TONE/SENSACAO
│   │   └── pu.types.ts
│   │
│   ├── kit-marca/
│   │   ├── components/
│   │   │   └── BrandKitForm.tsx
│   │   └── kit-marca.types.ts
│   │
│   ├── kit-imagem/
│   │   ├── components/
│   │   │   ├── ImageKitForm.tsx           # só fotos
│   │   │   └── VoiceCloneSection.tsx      # extraído de ImageKitForm
│   │   └── kit-imagem.types.ts
│   │
│   ├── admin/
│   │   ├── components/
│   │   │   ├── UsersTab.tsx               # decompor AssignPlanModal p/ arquivo próprio
│   │   │   ├── CobrancasTab.tsx
│   │   │   ├── CustosTab.tsx
│   │   │   └── ...demais tabs
│   │   └── modals/
│   │       └── AssignPlanModal.tsx
│   │
│   └── conta/
│       └── components/
│
├── shared/
│   ├── visual/                   # direção visual compartilhada MOP+PU
│   │   ├── buildAnchorPrefix.ts  # ÚNICO builder de referências (ex-referencesBlock + ex-buildAnchorPrefix)
│   │   ├── buildReferences.ts    # ex-regenerateWithKit buildReferences (já quase unificado)
│   │   ├── productHierarchy.ts   # ex-buildProductHierarchyBlock
│   │   └── visualDirection.lexicon.ts  # só dados: VISUAL_DIRECTIONS, MOOD_RULES
│   ├── text/
│   │   ├── textValidation.ts     # fatiado por tipo (caption/title/body)
│   │   └── correctSpelling.ts
│   ├── references/
│   │   └── referenciasPolicy.ts  # já isolado; remover policyComExtras sem uso
│   ├── ui/                       # shadcn/ui (existente — começar a usar!)
│   └── components/
│       ├── ConfirmDialog.tsx      # hook useConfirm() + dialog (padrão promise)
│       ├── ExhaustedBanner.tsx    # ex-banner triplicado do MetodoOpApp
│       ├── PlanSlotsBar.tsx       # ex-JSX de cotas do MetodoOpApp
│       ├── ModeSwitcher.tsx       # ex-abas Método/PU/Kit
│       ├── AuthFormLayout.tsx     # casca de login/signup/reset
│       └── GenerationProgress.tsx # já existe
│
├── domain/                       # tipos canônicos, ZERO React/IO
│   ├── segment.ts                # "VAREJO" | "SERVIÇOS" | "MARCA"
│   ├── mood.ts                   # VISUAL_DIRECTIONS union type
│   ├── objetivo.ts               # PU objetivos
│   ├── faixaEtaria.ts
│   ├── visualSelection.ts        # SelecaoDireta + PersonagemSemAvatar (UMA definição)
│   ├── brandKit.ts               # BrandKit interface
│   └── imageKit.ts               # ImageKit interface + StoredImageKit
│
├── services/                     # orquestração de chamadas externas (sem UI)
│   ├── openai/
│   │   └── openai.client.ts
│   ├── fal/
│   │   └── fal.client.ts
│   ├── elevenlabs/
│   └── meta/
│
├── repository/                   # ÚNICO ponto de acesso a dados
│   ├── authz.ts                  # isAdmin() via rpc("has_role") — UMA implementação
│   ├── brandKit.repo.ts          # getBrandKit / upsertBrandKit (funde loadKit + saveKit)
│   ├── imageKit.repo.ts          # getImageKit / saveImageKit / copyImageKit
│   ├── profile.repo.ts           # getProfileWithPlans / listProfilesWithPlans
│   └── billing.repo.ts           # checkBalance / debitUsage (ex-usage.server.ts)
│
├── server/                       # createServerFn por domínio (Workers-safe)
│   ├── imageKit.functions.ts
│   ├── kit.functions.ts
│   ├── usage.server.ts
│   └── meta.server.ts
│
├── lib/
│   └── storage/
│       ├── storageKeys.ts        # TODAS as chaves em um enum (nunca string literal)
│       └── scopedStore.ts        # get/set/remove com userId automático
│
├── hooks/                        # hooks transversais (não ligados a feature)
│   ├── useConfirm.ts             # promise-based (substitui window.confirm)
│   ├── usePersistedState.ts      # localStorage com escopo userId
│   └── usePlanSlots.ts           # ex-bloco 249-338 do MetodoOpApp
│
└── routes/                       # TanStack file-based (estrutura inalterada)
    ├── __root.tsx
    ├── index.tsx                  # landing
    ├── app.tsx                    # monta AppShell
    ├── historico.tsx
    ├── conta.tsx
    └── admin.tsx
```

---

## 3. LISTA DE BLOCOS A EXTRAIR

### Hooks a criar

| Nome | Extraído de | Responsabilidade |
|---|---|---|
| `useEffectiveUser()` | MetodoOpApp.tsx:260 | Resolve `impersonation?.userId \|\| user?.id`, encapsula `prevUserRef`/`form-owner` |
| `usePlanSlots()` | MetodoOpApp.tsx:249–338 | Calcula `rendersRestantes`, `imgsRestantes`, `puSlot`, `mopSlot`, `bonusSlot`, `*Exhausted`, auto-switch de slot |
| `useMopGeneration()` | MetodoOpApp.tsx (handleGenerate) | Orquestra geração MOP: prompt → OpenAI → normalização → Judge → resultado |
| `usePostUnicoGeneration()` | MetodoOpApp.tsx:800–934 | `handleGeneratePostUnico` (134 linhas) + 10 estados PU + 2 refs |
| `usePostUnicoCopy()` | PostUnicoForm.tsx | `generatePostUnicoCopy`, `autoRegenerateFlagged`, `judgeAndRegenerate` (lógica IA fora da UI) |
| `useCardGeneration(card, kind)` | ResultsView.tsx:675/733/776 etc. | Tríade `updatePreview/handleGenerate/handleGenerateWithRefs` (repetida 4× nos cards) |
| `useAnchorControl()` | ResultsView.tsx:3266–3350 | Estados `anchorGenderFlipped/anchorAgeOverride/anchorMode` + cálculo de `anchorControl` |
| `usePersistedState(key, default)` | MetodoOpApp.tsx:363–559 | localStorage com escopo automático por `effectiveUserId`, substitui 8 useEffect de persistência |
| `useBrandKitSync()` | MetodoOpApp.tsx | `handleKitChange`, `handleSave`, `handleLoadKit`, `handleClear`, efeitos de espelhamento |
| `useConfirm()` | MetodoOpApp.tsx:351–361 | Promise-based de confirmação, substitui `window.confirm` em 20 lugares no admin |

### Componentes a criar / extrair

| Nome | Extraído de | Responsabilidade |
|---|---|---|
| `AppShell.tsx` | MetodoOpApp.tsx | Layout raiz + roteamento de modo, sem lógica de negócio |
| `EditableField.tsx` | ResultsView.tsx:339–640 | Campo editável genérico (usado 9+ vezes — extrair para shared) |
| `FeedCard.tsx` | ResultsView.tsx | Card de feed MOP |
| `FinalCard.tsx` | ResultsView.tsx | Card final/estático MOP |
| `CarouselCardBlock.tsx` | ResultsView.tsx | Bloco de carrossel MOP |
| `ReelsCard.tsx` | ResultsView.tsx | Card de reels MOP |
| `StoriesBlock.tsx` | ResultsView.tsx | Bloco de stories MOP |
| `AnchorIndicator.tsx` | ResultsView.tsx | Indicador visual de âncora |
| `RefsRegenButton.tsx` | ResultsView.tsx | Botão de regen com refs |
| `PlanSlotsBar.tsx` | MetodoOpApp.tsx:991–1141 | Cards de plano + badge Admin + "Sem plano" + botão Bônus |
| `ModeSwitcher.tsx` | MetodoOpApp.tsx:1057–1103 | Abas Método/PU/Kit com lógica de `exhaustedHint` |
| `ExhaustedBanner.tsx` | MetodoOpApp.tsx:1143–1194 | Banner "esgotado" (hoje triplicado para mop/pu/bonus) |
| `AuthFormLayout.tsx` | login.tsx, signup.tsx, etc. | Casca compartilhada das rotas de autenticação |
| `AssignPlanModal.tsx` | UsersTab.tsx | Modal de atribuição de plano (extrair do tab) |
| `VoiceCloneSection.tsx` | ImageKitForm.tsx | Gravação/clone/TTS — feature separada das fotos |

### Services a criar

| Nome | Extraído de | Responsabilidade |
|---|---|---|
| `repository/authz.ts` | imageKit.functions.ts, users.functions.ts, etc. | `isAdmin(userId)` via `rpc("has_role")` — elimina 5 implementações divergentes |
| `repository/brandKit.repo.ts` | brandKit.ts (loadKitServer + loadKitForUser) | `getBrandKit / upsertBrandKit` com mapeamento `rowToKit/kitToRow` centralizado |
| `repository/imageKit.repo.ts` | imageKit.functions.ts | `getImageKit / saveImageKit / copyImageKit`, signed URLs, diff de slots |
| `repository/profile.repo.ts` | useProfile.ts:138–253 | `getProfileWithPlans` — remove mapeamento de billing do hook React |
| `repository/billing.repo.ts` | usage.server.ts | `checkBalance / debitUsage / checkRateLimit` com SLOTS enum único |
| `shared/visual/buildAnchorPrefix.ts` | postUnico.ts:502–701 + regenerateWithKit.ts:250–428 | ÚNICO builder de blocos de referência visual para imagem |

### Utils a criar

| Nome | Extraído de | Responsabilidade |
|---|---|---|
| `lib/storage/storageKeys.ts` | Strings espalhadas em 4+ arquivos | Enum/constantes de todas as chaves de localStorage |
| `lib/storage/scopedStore.ts` | storage.ts + imageKitStorage.ts + MetodoOpApp | get/set/remove/clear com escopo automático de userId |
| `features/mop/results/resultsView.utils.ts` | ResultsView.tsx | `insertSignature`, `countWords`, `runWithConcurrency`, `computeBlockGenders`, `distributeProduto` |
| `domain/visualSelection.ts` | types.ts (duplicado 3×) | `SelecaoDireta` + `PersonagemSemAvatar` — UMA definição |

---

## 4. ROADMAP DE MIGRAÇÃO

### Fase 0 — Rede de segurança (pré-requisito de tudo)
**O que fazer:** Escrever testes de snapshot das engines puras: `organizaMethodEngine`, `postUnico` (montagem de prompt), `referenciasPolicy`, `buildReferences`. Cobrir os caminhos S3V, S6V e PU principal com assertions sobre a string de prompt gerada.

**Critério de conclusão:** `npm test` verde cobrindo os 3 slots MOP e o PU principal. Nenhum arquivo de produção modificado.

**Risco:** Baixo — só adiciona testes, não toca código.

---

### Fase 1 — Centralizar localStorage e chaves
**O que fazer:**
1. Criar `lib/storage/storageKeys.ts` com enum de todas as chaves
2. Criar `lib/storage/scopedStore.ts` com `get/set/remove/clearUser(userId)`
3. Migrar leituras/escritas de `MetodoOpApp.tsx` (363–559), `useAuth.ts signOut` (41–45), `useImpersonation.ts`, `storage.ts` e `sessionImageCache.ts` para o novo módulo
4. Escopar `metodo-op-form-v1` por userId (eliminar dependência de `form-owner` como heurística)
5. Adicionar expiração de 1h nas URLs assinadas armazenadas (marcar com timestamp, re-fetch se expirado)

**Critério de conclusão:** Zero `localStorage.setItem/getItem` literal fora de `lib/storage`. Testar troca de usuário e entrada/saída de impersonação.

**Risco:** Médio — chave global de form vira chave por usuário; primeiro login pós-deploy perde form (aceitável, é cache temporário).

---

### Fase 2 — Unificar tipos de domínio
**O que fazer:**
1. Criar `domain/visualSelection.ts` com `SelecaoDireta` + `PersonagemSemAvatar` (hoje declaradas 3×)
2. Criar `domain/segment.ts`, `domain/mood.ts`, `domain/objetivo.ts` como enums canônicos
3. Fazer `RegenerateInput`, `buildReferences` e `PostUnicoVisualSelection` importar de `domain/`
4. Extrair tabelas de configuração para `*.config.ts`: `AUDIENCE_SEGMENT_CONFIG`, `OBJETIVO_*`, `VISUAL_DIRECTIONS` (dados separados de lógica)

**Critério de conclusão:** Build TypeScript passa. Uma só definição de cada shape; nenhuma redeclaração inline.

**Risco:** Baixo — refatoração guiada pelo compilador.

---

### Fase 3 — Unificar builder de referências visuais
**O que fazer:**
1. Criar `shared/visual/buildAnchorPrefix.ts` consolidando `referencesBlock` (postUnico.ts:502–701) e `buildAnchorPrefix` (regenerateWithKit.ts:250–428)
2. Atualizar `postUnico.ts` e `regenerateWithKit.ts` para importar o builder unificado
3. Mover `PostUnicoReferences` e `orderedReferenceImages` de `postUnico.ts` para `shared/visual/` (quebra a dependência MOP→PU)

**Critério de conclusão:** Zero duplicação de texto de prompt entre os dois motores; testes de snapshot da Fase 0 ainda passando (o output do prompt não deve mudar).

**Risco:** Médio — qualquer mudança no texto afeta geração de imagem; validar com geração real após o merge.

---

### Fase 4 — Extrair hooks de geração e persistência
**O que fazer:**
1. Criar `usePlanSlots()` extraindo MetodoOpApp.tsx:249–338
2. Criar `usePostUnicoGeneration()` extraindo MetodoOpApp.tsx:800–934 + os 10 estados PU
3. Criar `usePostUnicoCopy()` extraindo lógica de IA de PostUnicoForm.tsx
4. Criar `usePersistedState()` substituindo os 8 useEffect de persistência
5. Criar `useCardGeneration()` para os 4 cards de ResultsView

**Critério de conclusão:** `MetodoOpApp.tsx` abaixo de 500 linhas. `ResultsView.tsx` abaixo de 1000 linhas (cards extraídos). `PostUnicoForm.tsx` sem chamadas diretas a serviços de IA.

**Risco:** Médio — preservar a ordem Judge-antes-de-exibir (MetodoOpApp.tsx:753+) e os guards de regen.

---

### Fase 5 — Providers de Context
**O que fazer:**
1. Criar `SessionProvider` (auth + impersonação → `effectiveUserId` único)
2. Criar `BrandKitProvider` e `ImageKitProvider`
3. Criar `PlanProvider` (slots, cotas, slot de débito ativo)
4. Remover prop-drilling: `ContentForm` e `PostUnicoForm` passam a consumir Context em vez de receber 15+ props
5. Criar `ProfileContext` único (resolve `useProfile` sendo instanciado 6× em paralelo, com `ResultsView.tsx:3271` forçando `refreshProfile()` no mount)

**Critério de conclusão:** `ContentForm` e `PostUnicoForm` recebem no máximo 5 props. Sem `useProfile()` fora do provider.

**Risco:** Médio-alto — fazer um provider por vez, testar troca de impersonação a cada provider.

---

### Fase 6 — Camada repository e unificação de admin check
**O que fazer:**
1. Criar `repository/authz.ts` com `isAdmin()` via `rpc("has_role")` — eliminar os 5 lugares que usam `from("user_roles").eq("role","admin")`
2. Criar `repository/brandKit.repo.ts`, `imageKit.repo.ts`, `profile.repo.ts`, `billing.repo.ts`
3. Migrar `useProfile.ts:138–253` (mapeamento de billing) para `profile.repo.ts`
4. Proibir `supabase.from(...)` direto em hooks e componentes
5. Tipar os RPCs `has_role` e `debit_usage` nos tipos gerados do Supabase (eliminar `as never`)

**Critério de conclusão:** Zero `supabase.from(...)` fora de `repository/` e `server/`. Uma implementação de `isAdmin`. Build sem `as never` em fronteiras de segurança.

**Risco:** Médio — crítico para segurança; testar impersonação admin com kit de outro usuário.

---

### Fase 7 — Adotar shadcn/ui e unificar sistema de estilos
**O que fazer:**
1. Substituir `window.confirm` (20×) e `alert()` (28×) por `useConfirm()` + `ConfirmDialog`
2. Substituir reimplementações de abas por `ui/tabs.tsx`
3. Substituir botões inline-hex por `ui/button.tsx` com variantes
4. Substituir cards inline por `ui/card.tsx`
5. Substituir `<table>` manuais nos tabs admin por `ui/table.tsx`
6. Eliminar estilo inline com hex hardcoded (`#f4b000` → variável CSS/token Tailwind)
7. Unificar em um sistema: Tailwind + tokens shadcn (eliminar `metodo-op.css` ou convertê-lo)

**Critério de conclusão:** Zero `#f4b000`/`#0f213f` hardcoded fora de `tailwind.config`. Zero `window.confirm`/`alert`. Um sistema de estilos.

**Risco:** Baixo para visual (substitutos drop-in), médio para interações (testar todos os fluxos de confirmação).

---

### Fase 8 — Fatiar megafiles e concluir
**O que fazer:**
1. Fatiar `ResultsView.tsx` (3805 → 5 arquivos de card + hook + utils)
2. Fatiar `organizaMethodEngine.ts` (870 → buildMopPrompt + normalizeMopResult + configs)
3. Fatiar `postUnico.ts` (1026 → buildPuPrompt + objetivo.config)
4. Fatiar `visualDirection.ts` (1035 → lexicon.ts + builders especializados)
5. Fatiar `textValidation.ts` (1222 → por tipo de validação)

**Critério de conclusão:** Nenhum arquivo acima de 500 linhas. Testes de snapshot da Fase 0 ainda passando.

**Risco:** Alto — exige a rede de testes da Fase 0; é a última fase por esse motivo.

---

## 5. REGRAS DE CONVENÇÃO (v2.0)

**1. Nenhum componente acima de 400 linhas.**
Se um arquivo de componente passa de 400 linhas, extrair hook ou subcomponente antes de continuar. Alvos atuais que quebram essa regra: `ResultsView.tsx` (3805), `MetodoOpApp.tsx` (1374), `PostUnicoForm.tsx` (1490), `UsersTab.tsx` (1606), `ImageKitForm.tsx` (1045).

**2. `localStorage` só via `lib/storage`.**
Zero `localStorage.setItem/getItem/removeItem` literal em componente, hook ou service. Toda chave nasce em `storageKeys.ts`. Toda operação usa `scopedStore.ts` que faz escopo por userId automaticamente.

**3. Um shape, uma definição.**
Tipos de domínio (`SelecaoDireta`, `PersonagemSemAvatar`, enums de segmento/mood/objetivo) vivem em `domain/` e são importados de lá. Proibido redeclarar inline ou duplicar em `types.ts` + `regenerateWithKit.ts` + arquivo local.

**4. Engines são puras.**
Arquivos em `features/*/engine/` e `shared/visual/` não importam React, Supabase, localStorage nem hooks. Recebem tudo por parâmetro e retornam `string | object`. São testáveis em Node sem mock de ambiente.

**5. Dados separados de template.**
Tabelas de configuração (`AUDIENCE_SEGMENT_CONFIG`, `OBJETIVO_*`, `VISUAL_DIRECTIONS`, `momentModulators`) ficam em `*.config.ts` ou `*.lexicon.ts` — sem lógica condicional. Lógica que usa os dados fica no builder.

**6. Acesso a Supabase só em `repository/` e `server/`.**
Hooks e componentes nunca chamam `supabase.from(...)`, `supabaseAdmin.from(...)` ou `rpc(...)` diretamente. Toda query passa por uma função de repositório com tipo de retorno explícito.

**7. Admin check sempre via `repository/authz.isAdmin()`.**
Proibido `from("user_roles").eq("role","admin")` fora do repositório. Proibido verificar papel via JWT claims direto. Proibido `as never` em chamadas de RPC de segurança — tipar via tipos gerados do Supabase.

**8. Estado global vai para Context, não para props.**
Se uma prop atravessa mais de 2 níveis de componente (kit, imageKit, plano, usuário efetivo), ela vira Context. Prop drilling de 15+ props (como `PostUnicoForm` atual) é bloqueado em review.

**9. `window.confirm` e `alert()` são proibidos.**
Toda confirmação destrutiva usa `useConfirm()` (promise-based). Todo feedback de erro/sucesso usa o componente de toast/alerta do design system — nunca string nativa do browser.

**10. Toda regra de negócio nova nas engines entra com teste de snapshot.**
Mudar comportamento de geração de prompt (novo bloco, nova condição, novo segmento) sem adicionar ou atualizar um teste de snapshot é bloqueado. O teste não precisa chamar a IA — só verifica que o texto do prompt contém o esperado.

---

## Sumário executivo

Os bugs recorrentes do Método OP (modo PU↔MOP trocando sozinho, audience resetando, gênero errado, produto aparecendo em formato proibido, contadores zerando, copy perdido ao navegar) têm **duas causas-raiz estruturais**, não bugs pontuais:

1. **Lógica de negócio dentro da árvore React** — quando o componente desmonta, o estado some. A solução pontual foi içar estado para cima (MetodoOpApp), mas isso criou um god component que acumula tudo.

2. **Ausência de camada de dados** — chaves de localStorage espalhadas, admin check duplicado, billing inline, tipos redeclarados. Cada fix adiciona uma heurística (form-owner, prevUserRef, slotInitRef) em vez de resolver a estrutura.

**Ordem de máxima alavanca com mínimo risco:**
Fase 0 (testes) → Fase 1 (storage) → Fase 2 (tipos) → Fase 3 (builder unificado) → Fase 4 (hooks) → Fase 5 (context) → Fase 6 (repository) → Fase 7 (design system) → Fase 8 (fatiar megafiles).

As Fases 0–3 são as de maior retorno imediato: estabelecem a rede de segurança e eliminam as duas classes de bugs mais frequentes sem tocar na UI.
