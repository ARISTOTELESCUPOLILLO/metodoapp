import { useState, useRef } from "react";
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
import {
  defaultKit,
  defaultForm,
  defaultPostUnico,
  defaultVisualSelection,
  type Modo,
} from "./data/appDefaults";
import { loadImageKit } from "./utils/imageKitStorage";
import { lsGetRaw } from "./lib/storage/store";
import { MODO_KEY, MOOD_KEY } from "./lib/storage/keys";
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
import { useAppPersistence } from "./hooks/useAppPersistence";
import { useAppConfirm } from "./hooks/useAppConfirm";
import { AppHeader } from "./components/metodo-op/AppHeader";
import { ImageKitInfoPanel } from "./components/metodo-op/ImageKitInfoPanel";
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
  const { confirmState, askConfirm, resolveConfirm } = useAppConfirm();

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

  const {
    imageKitSaved,
    handleGenerate,
    handleClearMethodResult,
    handleClearMethodGeneration,
    handleSaveImageKit,
  } = useMopHandlers({
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

  useAppPersistence({
    modo,
    setModo,
    mood,
    result,
    postUnico,
    postUnicoImg,
    caption,
    postUnicoStarted,
    visualSelection,
    effectiveUserId,
    slots,
  });

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
    onResetCopyRegen: () => {
      setPuTituloRegen(0);
      setPuTextoRegen(0);
    },
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

  return (
    <ProfileProvider value={profileCtxValue}>
      <BrandKitProvider value={brandKitCtxValue}>
        <ImageKitProvider value={imageKitCtxValue}>
          <MoodProvider value={moodCtxValue}>
            <PlanSlotsProvider value={planSlotsCtxValue}>
              <PostUnicoStateProvider value={postUnicoStateCtxValue}>
                <main className="appShell">
                  <AppHeader
                    profile={profile ?? null}
                    user={user}
                    impersonation={impersonation ?? null}
                    onStopImpersonation={() => {
                      stopImpersonation();
                      window.location.reload();
                    }}
                    profileLoading={profileLoading}
                    slots={slots}
                    effectiveAdmin={effectiveAdmin}
                    modo={modo}
                    setModo={setModo}
                    mopExhausted={mopExhausted}
                    puExhausted={puExhausted}
                    bonusExhausted={bonusExhausted}
                    bonusIsPuType={bonusIsPuType}
                    bonusSlotInfoObj={bonusSlotInfoObj}
                    selectedSlot={selectedSlot}
                    setSelectedSlot={setSelectedSlot}
                    exhaustedHint={exhaustedHint}
                    setExhaustedHint={setExhaustedHint}
                  />

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
                          onRegenerate={() =>
                            handleGeneratePostUnico(undefined, { regenerate: true })
                          }
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
                      {modo === "imageKit" && <ImageKitInfoPanel />}
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
                  onConfirm={() => resolveConfirm(true)}
                  onCancel={() => resolveConfirm(false)}
                />
              </PostUnicoStateProvider>
            </PlanSlotsProvider>
          </MoodProvider>
        </ImageKitProvider>
      </BrandKitProvider>
    </ProfileProvider>
  );
}
