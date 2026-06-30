import { useState, useEffect, useRef } from "react";
import BrandKitForm from "./components/metodo-op/BrandKitForm";
import ConfirmDialog from "./components/metodo-op/ConfirmDialog";
import ContentForm from "./components/metodo-op/ContentForm";
import ResultsView from "./components/metodo-op/ResultsView";
import PostUnicoForm from "./components/metodo-op/PostUnicoForm";
import PostUnicoResult from "./components/metodo-op/PostUnicoResult";
import GenerationProgress from "./components/metodo-op/GenerationProgress";
import ImageKitForm from "./components/metodo-op/ImageKitForm";
import { usePostUnicoGeneration } from "./hooks/usePostUnicoGeneration";
import { useServerFn } from "@tanstack/react-start";
import { defaultKit, defaultForm, defaultPostUnico, defaultVisualSelection, savePostUnico, type Modo } from "./data/appDefaults";
import { loadImageKit } from "./utils/imageKitStorage";
import {
  lsGet,
  lsRemove,
  lsGetRaw,
  lsSetRaw,
  lsSetQuotaSafe,
  ssGet,
  ssSet,
} from "./lib/storage/store";
import {
  MODO_KEY,
  MOOD_KEY,
  RESULT_KEY,
  PU_IMG_KEY,
  PU_CAPTION_KEY,
  PU_STARTED_KEY,
  PU_VISUAL_KEY,
  MODO_INIT_KEY,
} from "./lib/storage/keys";
import { loadKitServer, saveKitServer } from "./services/brandKit";
import {
  BrandKit,
  ContentFormData,
  ImageKit,
  MethodOpResult,
  MoodCode,
  PostUnicoFormData,
  PostUnicoVisualSelection,
} from "./types";
import { useAuth } from "./hooks/useAuth";
import { useProfile } from "./hooks/useProfile";
import { useImpersonation, stopImpersonation } from "./hooks/useImpersonation";
import { buildPlanAccess } from "./lib/planAccess";
import { usePlanSlots } from "./hooks/usePlanSlots";
import { useBrandKitActions } from "./hooks/useBrandKitActions";
import { useMopHandlers } from "./hooks/useMopHandlers";
import { useUserDataRestore } from "./hooks/useUserDataRestore";
import { PlanSlotsBar } from "./components/metodo-op/PlanSlotsBar";
import { ModeSwitcher } from "./components/metodo-op/ModeSwitcher";
import { ExhaustedBanner } from "./components/metodo-op/ExhaustedBanner";
import { BrandKitProvider } from "./contexts/BrandKitContext";
import { ImageKitProvider } from "./contexts/ImageKitContext";
import { ProfileProvider } from "./contexts/ProfileContext";
import { MoodProvider } from "./contexts/MoodContext";
import { PlanSlotsProvider } from "./contexts/PlanSlotsContext";
import { PostUnicoStateProvider } from "./contexts/PostUnicoStateContext";
import "./metodo-op.css";

export default function App() {
  const [modo, setModo] = useState<Modo>(() => {
    if (typeof window === "undefined") return "metodo";
    const v = lsGetRaw(MODO_KEY);
    if (v === "postUnico" || v === "imageKit" || v === "metodo") return v as Modo;
    return "metodo";
  });
  const [kit, setKit] = useState<BrandKit>(() => defaultKit);
  const [imageKit, setImageKit] = useState<ImageKit>(() => loadImageKit(null));
  const [visualSelection, setVisualSelection] =
    useState<PostUnicoVisualSelection>(defaultVisualSelection);
  const [mood, setMood] = useState<MoodCode | null>(() => {
    const m = lsGetRaw(MOOD_KEY);
    if (m && ["OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06"].includes(m))
      return m as MoodCode;
    return null;
  });
  const [result, setResult] = useState<MethodOpResult | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ContentFormData>(() => ({
    ...defaultForm,
    track: defaultForm.track || "cinematica",
  }));
  const [postUnico, setPostUnico] = useState<PostUnicoFormData>(() => ({ ...defaultPostUnico }));
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message?: string;
    resolve: (v: boolean) => void;
  } | null>(null);

  const { user } = useAuth();
  const impersonation = useImpersonation();
  const {
    profile,
    slots,
    isAdmin,
    isSelfAdmin,
    cotaPersonalizados,
    loading: profileLoading,
    refresh: refreshProfile,
  } = useProfile(impersonation?.userId || null);
  const loadKitServerFn = useServerFn(loadKitServer);
  const saveKitServerFn = useServerFn(saveKitServer);
  const effectiveAdmin = impersonation ? isAdmin : isSelfAdmin || isAdmin;
  const planAccess = buildPlanAccess(slots, false);
  const rendersTotal = slots.reduce((s, sl) => s + (sl.rendersLimite || 0), 0);
  const rendersUsadosSum = slots.reduce((s, sl) => s + (sl.rendersUsados || 0), 0);
  const rendersRestantes = Math.max(0, rendersTotal - rendersUsadosSum);
  const imgsTotal = slots.reduce((s, sl) => s + (sl.imgsLimite || 0), 0);
  const imgsUsadasSum = slots.reduce((s, sl) => s + (sl.imgsUsadas || 0), 0);
  const imgsRestantes = Math.max(0, imgsTotal - imgsUsadasSum);
  const geracoesTotal = slots.reduce((s, sl) => s + (sl.geracoesLimite || 0), 0);
  const geracoesUsadasSum = slots.reduce((s, sl) => s + (sl.geracoesUsadas || 0), 0);
  const geracoesRestantes = Math.max(0, geracoesTotal - geracoesUsadasSum);
  const semPlano = slots.length === 0 && !effectiveAdmin;
  const effectiveUserId = impersonation?.userId || user?.id || null;
  const prevUserRef = useRef<string | null>(null);

  const {
    puImgsTotal,
    puImgsRestantes,
    puExhausted,
    mopExhausted,
    bonusSlotInfoObj,
    bonusExhausted,
    bonusIsPuType,
    selectedSlot,
    setSelectedSlot,
    exhaustedHint,
    setExhaustedHint,
  } = usePlanSlots(slots, planAccess, modo, effectiveUserId);

  const {
    postUnicoImg,
    setPostUnicoImg,
    postUnicoStarted,
    setPostUnicoStarted,
    caption,
    setCaption,
    captionLoading,
    captionError,
    puTituloRegen,
    setPuTituloRegen,
    puTextoRegen,
    setPuTextoRegen,
    puCaptionRegen,
    puCopy,
    setPuCopy,
    puCopyOriginal,
    setPuCopyOriginal,
    handleGeneratePostUnico,
    handleGenerateCaption,
    clearPostUnicoState,
  } = usePostUnicoGeneration({
    postUnico,
    kit,
    imageKit,
    setImageKit,
    visualSelection,
    selectedSlot,
    effectiveUserId,
    refreshProfile,
    setLoading,
    setError,
  });

  function askConfirm(title: string, message?: string): Promise<boolean> {
    return new Promise((resolve) => setConfirmState({ title, message, resolve }));
  }

  const {
    saving,
    saved,
    loadingKit,
    lockedSegment,
    handleKitChange,
    handleSave,
    handleClear,
    handleLoadKit,
  } = useBrandKitActions({
    kit,
    setKit,
    form,
    setForm,
    setPostUnico,
    effectiveUserId,
    impersonation: impersonation ?? null,
    loadKitServerFn,
    saveKitServerFn,
    askConfirm,
    profile: profile ?? null,
    defaultKit,
    defaultForm,
    defaultPostUnico,
  });

  const { imageKitSaved, handleGenerate, handleClearMethodResult, handleClearMethodGeneration, handleSaveImageKit } =
    useMopHandlers({
      form,
      kit,
      mood,
      imageKit,
      setImageKit,
      effectiveUserId,
      selectedSlot,
      setResult,
      setLoading,
      setError,
      refreshProfile,
      askConfirm,
    });

  useUserDataRestore({
    effectiveUserId,
    prevUserRef,
    impersonation: impersonation ?? null,
    loadKitServerFn,
    handleKitChange,
    setForm,
    setPostUnico,
    setKit,
    setVisualSelection,
    setPostUnicoImg,
    setCaption,
    setPostUnicoStarted,
    setImageKit,
    setResult,
    setPuCopy,
    setPuCopyOriginal,
  });

  useEffect(() => {
    if (effectiveUserId) savePostUnico(postUnico, effectiveUserId);
  }, [postUnico, effectiveUserId]);
  useEffect(() => { lsSetRaw(MODO_KEY, modo); }, [modo]);
  useEffect(() => { if (mood) lsSetRaw(MOOD_KEY, mood); }, [mood]);

  // Auto-seleciona modo pelo plano1 ao logar — uma vez por login nesta aba.
  useEffect(() => {
    if (!effectiveUserId || !slots.length) return;
    const key = `${MODO_INIT_KEY}:${effectiveUserId}`;
    if (ssGet(key) === "1") return;
    ssSet(key, "1");
    const plano1 = slots.find((s) => s.key === "plano1");
    if (!plano1) return;
    if (/^PU/i.test(plano1.plan.codigo)) setModo("postUnico");
    else setModo("metodo");
  }, [effectiveUserId, slots]);

  // Persistência do conteúdo gerado por usuário
  useEffect(() => {
    if (!effectiveUserId) return;
    if (result === undefined) lsRemove(RESULT_KEY, effectiveUserId);
    else lsSetQuotaSafe(RESULT_KEY, JSON.stringify(result), effectiveUserId);
  }, [result, effectiveUserId]);
  useEffect(() => {
    if (!effectiveUserId) return;
    if (postUnicoImg === undefined) lsRemove(PU_IMG_KEY, effectiveUserId);
    else lsSetQuotaSafe(PU_IMG_KEY, JSON.stringify(postUnicoImg), effectiveUserId);
  }, [postUnicoImg, effectiveUserId]);
  useEffect(() => {
    if (!effectiveUserId) return;
    if (caption === undefined) lsRemove(PU_CAPTION_KEY, effectiveUserId);
    else lsSetQuotaSafe(PU_CAPTION_KEY, JSON.stringify(caption), effectiveUserId);
  }, [caption, effectiveUserId]);
  useEffect(() => {
    if (!effectiveUserId) return;
    lsSetQuotaSafe(PU_STARTED_KEY, postUnicoStarted ? "true" : "false", effectiveUserId);
  }, [postUnicoStarted, effectiveUserId]);
  useEffect(() => {
    if (!effectiveUserId) return;
    lsSetQuotaSafe(PU_VISUAL_KEY, JSON.stringify(visualSelection), effectiveUserId);
  }, [visualSelection, effectiveUserId]);

  // ── Valores de contexto ────────────────────────────────────────────────────
  const profileCtxValue = {
    profile: profile ?? null,
    slots,
    planAccess,
    profileLoading,
    refreshProfile,
    rendersTotal,
    rendersRestantes,
    imgsTotal,
    imgsRestantes,
    geracoesTotal,
    geracoesRestantes,
    semPlano,
    isAdmin,
    isSelfAdmin,
    effectiveAdmin,
    cotaPersonalizados,
  };
  const brandKitCtxValue = { kit, lockedSegment, handleKitChange };
  const imageKitCtxValue = { imageKit, setImageKit };
  const moodCtxValue = { mood, setMood };
  const planSlotsCtxValue = {
    selectedSlot,
    setSelectedSlot,
    puImgsTotal,
    puImgsRestantes,
    puExhausted,
    mopExhausted,
    exhaustedHint,
    setExhaustedHint,
    bonusSlotInfoObj,
    bonusExhausted,
    bonusIsPuType,
    hasPostPlano: profileLoading ? undefined : planAccess.hasPostUnico,
  };
  const postUnicoStateCtxValue = {
    visualSelection,
    setVisualSelection,
    puCopy,
    setPuCopy,
    puCopyOriginal,
    setPuCopyOriginal,
    puTituloRegen,
    setPuTituloRegen,
    puTextoRegen,
    setPuTextoRegen,
    onTituloRegen: () => setPuTituloRegen((c) => c + 1),
    onTextoRegen: () => setPuTextoRegen((c) => c + 1),
    onResetCopyRegen: () => { setPuTituloRegen(0); setPuTextoRegen(0); },
  };

  async function handleClearPostUnico() {
    if (
      !(await askConfirm(
        "Limpar Post Único",
        "Isso vai apagar a peça gerada e a legenda. A informação-chave é preservada. Deseja continuar?",
      ))
    )
      return;
    setPostUnico({
      ...defaultPostUnico,
      companyName: kit.companyName || "",
      mainActivity: kit.mainActivity || "",
      audience: postUnico.audience,
      keyInfo: postUnico.keyInfo,
    });
    clearPostUnicoState();
    setError("");
    setVisualSelection(defaultVisualSelection);
  }

  const greetingName = impersonation?.nome || profile?.nome || user?.email || "";
  const ultimoLoginFmt = profile?.ultimo_login
    ? new Date(profile.ultimo_login).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "primeiro acesso";

  return (
    <ProfileProvider value={profileCtxValue}>
    <BrandKitProvider value={brandKitCtxValue}>
    <ImageKitProvider value={imageKitCtxValue}>
    <MoodProvider value={moodCtxValue}>
    <PlanSlotsProvider value={planSlotsCtxValue}>
    <PostUnicoStateProvider value={postUnicoStateCtxValue}>
      <main className="appShell">
        <header className="hero">
          <span className="eyebrow mb-0 mt-[10px]">
            Organiza o conteúdo, gera a imagem e a legenda no app.
          </span>
          <h1 style={{ fontWeight: 900 }}>
            <span style={{ color: "#ffffff" }}>MÉTODO</span>{" "}
            <span style={{ color: "#f4b000" }}>OP</span>
          </h1>
          {greetingName && (
            <div style={{ color: "rgba(255,255,255,.78)", fontSize: 13, marginTop: 4, fontWeight: 500 }}>
              Olá, <strong style={{ color: "#fff" }}>{greetingName}</strong> · Último acesso:{" "}
              {ultimoLoginFmt}
            </div>
          )}
          <PlanSlotsBar profileLoading={profileLoading} slots={slots} effectiveAdmin={effectiveAdmin} />
          <ModeSwitcher
            modo={modo}
            setModo={setModo}
            mopExhausted={mopExhausted}
            puExhausted={puExhausted}
            bonusExhausted={bonusExhausted}
            bonusIsPuType={bonusIsPuType}
            bonusSlotInfoObj={bonusSlotInfoObj}
            selectedSlot={selectedSlot}
            setSelectedSlot={setSelectedSlot}
            setExhaustedHint={setExhaustedHint}
          />
          <ExhaustedBanner exhaustedHint={exhaustedHint} />
          {impersonation && (
            <div className="heroActions">
              <button
                className="clientBtn"
                type="button"
                onClick={() => { stopImpersonation(); window.location.reload(); }}
                style={{ background: "#fde68a", color: "#78350f", borderColor: "#f59e0b" }}
                title="Sair do modo Atuar como"
              >
                ⏻ Sair de "atuando como {impersonation.nome}"
              </button>
            </div>
          )}
        </header>

        <div className="layout">
          <div className="leftCol">
            <BrandKitForm
              kit={kit}
              onChange={handleKitChange}
              onSave={handleSave}
              onLoad={handleLoadKit}
              onClear={handleClear}
              loading={loadingKit}
              saving={saving}
              saved={saved}
              lockedSegment={lockedSegment}
            />
            {modo === "metodo" && (
              <ContentForm
                data={form}
                onChange={setForm}
                onGenerate={handleGenerate}
                onClear={handleClearMethodGeneration}
                loading={loading}
              />
            )}
            {modo === "postUnico" && (
              <PostUnicoForm
                data={postUnico}
                onChange={setPostUnico}
                onGenerate={handleGeneratePostUnico}
                onClear={handleClearPostUnico}
                loading={loading}
              />
            )}
            {modo === "imageKit" && (
              <ImageKitForm
                kit={imageKit}
                onChange={setImageKit}
                onSave={handleSaveImageKit}
                saved={imageKitSaved}
              />
            )}
          </div>
          <div className="rightCol">
            {error && <div className="errorBox">{error}</div>}
            {loading && modo === "postUnico" ? (
              <GenerationProgress active={loading} expectedMs={60_000} />
            ) : loading && modo === "metodo" ? (
              <div className="loadingBox">
                <div className="spinner" />
                <p>Gerando conteúdo com o método...</p>
              </div>
            ) : null}
            <div style={{ display: modo === "metodo" ? undefined : "none" }}>
              <ResultsView
                result={result}
                kit={kit}
                mood={mood ?? "OP-01"}
                onClear={handleClearMethodResult}
                onRetry={handleGenerate}
                imageKit={imageKit}
                sequenceSize={form.sequenceSize}
                onImageGenerated={refreshProfile}
                userId={effectiveUserId}
                faixaEtariaForm={form.faixaEtaria}
                generoPrefForm={form.generoPref}
              />
            </div>
            {modo === "postUnico" && (
              <PostUnicoResult
                imageDataUrl={postUnicoImg}
                companyName={kit.companyName}
                onRegenerate={() => handleGeneratePostUnico(undefined, { regenerate: true })}
                regenerating={loading}
                caption={caption}
                captionLoading={captionLoading}
                captionError={captionError}
                onRegenerateCaption={handleGenerateCaption}
                onClear={handleClearPostUnico}
                started={postUnicoStarted}
                slot={selectedSlot}
                direcao={postUnico.direcao}
                mood={postUnico.mood}
                assinatura={kit.assinatura || ""}
                captionRegenCount={puCaptionRegen}
              />
            )}
            {modo === "imageKit" && (
              <div className="panel" style={{ padding: 24 }}>
                <span className="eyebrow">Como usar</span>
                <h2 style={{ marginTop: 4 }}>Kit Imagem</h2>
                <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
                  Suba até 2 avatares, 2 cenários, 8 produtos, e também as fotos de Fato e Venda. As
                  imagens ficam salvas na sua conta e ficam disponíveis em qualquer dispositivo onde
                  você entrar. Depois, no <strong>Método OP</strong> e no{" "}
                  <strong>Post Único</strong>, marque quais delas a IA deve usar como referência
                  visual ao montar a peça. A numeração dos produtos é fixa: apagar o produto 3 deixa
                  o slot vazio até você subir outro.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title || ""}
        message={confirmState?.message}
        confirmLabel="Limpar"
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={() => {
          const r = confirmState?.resolve;
          setConfirmState(null);
          r?.(true);
        }}
        onCancel={() => {
          const r = confirmState?.resolve;
          setConfirmState(null);
          r?.(false);
        }}
      />
    </PostUnicoStateProvider>
    </PlanSlotsProvider>
    </MoodProvider>
    </ImageKitProvider>
    </BrandKitProvider>
    </ProfileProvider>
  );
}
