import { useEffect, useRef, useState } from "react";
import { FaixaEtaria, PostUnicoDirecao, PostUnicoFormData, PostUnicoObjetivo } from "../../types";
import type { PostUnicoCopy } from "../../services/postUnico";
import { usePostUnicoCopy } from "../../hooks/usePostUnicoCopy";
import { getAuthHeaders } from "../../services/authHeaders";
import PostUnicoComposicaoVisual from "./PostUnicoComposicaoVisual";
import { useTextCorrection } from "@/hooks/useTextCorrection";
import { useBrandKit } from "../../contexts/BrandKitContext";
import { useImageKit } from "../../contexts/ImageKitContext";
import { useAppProfile } from "../../contexts/ProfileContext";
import { usePlanSlotsCtx } from "../../contexts/PlanSlotsContext";
import { usePostUnicoState } from "../../contexts/PostUnicoStateContext";
import { CopySection } from "./postUnicoForm/CopySection";
import { PostUnicoKeyInfoSection } from "./postUnicoForm/PostUnicoKeyInfoSection";
import { DirecaoVisualSection } from "./postUnicoForm/DirecaoVisualSection";
import { IdeiasSheet } from "./contentForm/IdeiasSheet";

interface Props {
  data: PostUnicoFormData;
  onChange: (data: PostUnicoFormData) => void;
  onGenerate: (copy?: PostUnicoCopy) => void;
  onClear?: () => void;
  loading: boolean;
}

const OBJETIVOS: { code: PostUnicoObjetivo; label: string; desc: string }[] = [
  { code: "nenhum", label: "Nenhum", desc: "Deixe a IA decidir o tom" },
  { code: "institucional", label: "Institucional", desc: "Posicionamento, propósito, marca" },
  { code: "aviso", label: "Aviso", desc: "Comunicado institucional" },
  { code: "homenagem", label: "Homenagem", desc: "Pessoa, data, conquista" },
  { code: "oportunidade", label: "Oportunidade", desc: "Momento único, urgência" },
  { code: "promocao", label: "Promoção", desc: "Oferta, campanha comercial" },
  { code: "fatos", label: "Fatos", desc: "Registrar evento — foto real do momento" },
  { code: "venda", label: "Venda", desc: "Colaborador com o produto — foto real" },
];

export default function PostUnicoForm({ data, onChange, onGenerate, onClear, loading }: Props) {
  const { kit } = useBrandKit();
  const { imageKit } = useImageKit();
  const { geracoesRestantes, geracoesTotal, semPlano, effectiveAdmin: isAdmin } = useAppProfile();
  const { puImgsRestantes: imgsRestantes, puImgsTotal: imgsTotal, selectedSlot: puSlot, hasPostPlano } = usePlanSlotsCtx();
  const {
    visualSelection,
    setVisualSelection: onVisualSelectionChange,
    puCopy: copy,
    setPuCopy: setCopy,
    puCopyOriginal: copyOriginal,
    setPuCopyOriginal: setCopyOriginal,
    puTituloRegen: tituloRegenCount,
    puTextoRegen: textoRegenCount,
    onTituloRegen,
    onTextoRegen,
    onResetCopyRegen,
  } = usePostUnicoState();
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestCount, setSuggestCount] = useState(0);
  const [showIdeiasPanel, setShowIdeiasPanel] = useState(false);
  const initialKeyInfoRef = useRef<string | null>(null);
  const allSessionSuggestionsRef = useRef<string[]>([]);
  // Semente fixa por sessão de sugestões — enviada ao servidor (stateless) pra
  // garantir que as tentativas 0/1/2 caiam em lentes diferentes dentro da
  // sessão, mas variem entre sessões novas (ver lensIndex em suggest-keyinfo.ts).
  const sessionSeedRef = useRef<number>(Math.floor(Math.random() * 1e9));
  const [selectedProducts, setSelectedProducts] = useState<string[]>(() => kit.products || []);
  const keyInfoCorrection = useTextCorrection();
  const SUGGEST_MAX = 3;
  const hasKeyInfo = !!data.keyInfo.trim();
  const suggestExhausted = !isAdmin && suggestCount >= SUGGEST_MAX;
  const canClear = hasKeyInfo || suggestCount > 0;
  const initialKeyInfo = initialKeyInfoRef.current;
  const canRevertInitial = initialKeyInfo !== null && data.keyInfo !== initialKeyInfo;

  const copyTRegenCount = tituloRegenCount ?? 0;
  const copyXRegenCount = textoRegenCount ?? 0;
  const {
    copyLoading,
    copyError,
    copyTBusy,
    copyXBusy,
    copyTError,
    copyXError,
    copyTSuggs,
    setCopyTSuggs,
    copyXSuggs,
    setCopyXSuggs,
    copyKeyInfoRef,
    fetchCopy,
    regenField,
    clearCopy,
  } = usePostUnicoCopy({
    data,
    kit,
    puSlot,
    isAdmin,
    tituloRegenCount,
    textoRegenCount,
    onTituloRegen,
    onTextoRegen,
    onResetCopyRegen,
    copy,
    setCopy,
    setCopyOriginal,
  });

  useEffect(() => {
    setSuggestCount(0);
    setSuggestions([]);
    setSuggestError(null);
    initialKeyInfoRef.current = null;
    allSessionSuggestionsRef.current = [];
    sessionSeedRef.current = Math.floor(Math.random() * 1e9);
  }, [data.objetivo, kit.companyName]);

  // Checklist de produtos/serviços — todos marcados por padrão; reseta
  // quando a lista do Kit de Marca muda (ex.: kit carregado ou editado).
  useEffect(() => {
    setSelectedProducts(kit.products || []);
  }, [kit.products]);

  useEffect(() => {
    if (!data.keyInfo) {
      setSuggestions([]);
      setSuggestError(null);
      initialKeyInfoRef.current = null;
      // suggestCount e allSessionSuggestionsRef NÃO são resetados — preservam
      // o rodízio de produto/lente entre pedidos de sugestão
    }
    if (copy && data.keyInfo !== copyKeyInfoRef.current) {
      clearCopy({ resetCounter: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a keyInfo; `copy`/`clearCopy` são lidos, não devem re-disparar o efeito
  }, [data.keyInfo]);

  // Reseta copy quando o objetivo muda; NENHUM não suporta mood → força LIVRE.
  // prevObjetivoRef evita que o efeito dispare no mount (remontagem ao voltar
  // de outra aba não deve limpar o copy já gerado e persistido no app).
  const prevObjetivoRef = useRef<string>(data.objetivo);
  useEffect(() => {
    if (data.objetivo === prevObjetivoRef.current) return;
    prevObjetivoRef.current = data.objetivo;
    clearCopy({ resetCounter: false });
    if (data.objetivo === "nenhum" && data.direcao === "mood") {
      onChange({ ...data, direcao: "livre", mood: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a objetivo; demais são lidos via ref/data atual
  }, [data.objetivo]);

  const update = <K extends keyof PostUnicoFormData>(key: K, value: PostUnicoFormData[K]) =>
    onChange({ ...data, [key]: value });

  const setDirecao = (dir: PostUnicoDirecao) => {
    if (dir === "mood") {
      onChange({ ...data, direcao: "mood", mood: data.mood });
    } else {
      onChange({ ...data, direcao: "livre", mood: undefined });
    }
  };

  async function fetchSuggestion() {
    // suggesting precisa entrar aqui (não só no `disabled` do botão): o botão
    // "Gerar outra" some da tela só depois do próximo render, então um duplo
    // clique físico rápido pode disparar 2 chamadas antes do React remover o
    // botão — sem esse guard, as 2 chamadas usam o MESMO attempt/
    // previousSuggestions (nenhuma delas atualizou o estado ainda) e
    // pickConcreteItem, sendo determinístico, escolhe o MESMO item nas duas.
    if (suggesting || suggestExhausted || hasKeyInfo) return;
    setSuggesting(true);
    setSuggestError(null);
    const attempt = suggestCount;

    try {
      const auth = await getAuthHeaders();
      const res = await fetch("/api/suggest-keyinfo", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({
          companyName: data.companyName || kit.companyName,
          mainActivity: data.mainActivity || kit.mainActivity,
          audience: data.audience,
          objetivo: data.objetivo,
          segment: kit.segment,
          isPersonalBrand: kit.isPersonalBrand,
          brandVoice: kit.brandVoice || "",
          hint: "",
          mode: "postunico",
          attempt,
          sessionSeed: sessionSeedRef.current,
          subMode: "sugerir",
          previousSuggestions: allSessionSuggestionsRef.current,
          selectedProducts,
          preferredSlot: puSlot,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Falha (${res.status})`);
      }
      const json = await res.json();
      const newSugg = String(json.sugestao || "").trim();
      if (newSugg) {
        setSuggestions((arr) => [...arr, newSugg]);
        allSessionSuggestionsRef.current = [...allSessionSuggestionsRef.current, newSugg];
      }
      setSuggestCount((c) => c + 1);
    } catch (e) {
      setSuggestError((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  const isNenhum = data.objetivo === "nenhum";
  const semGeracoes =
    typeof geracoesRestantes === "number" && geracoesRestantes <= 0 && (geracoesTotal || 0) > 0;
  const semImagens =
    typeof imgsRestantes === "number" && imgsRestantes <= 0 && (imgsTotal || 0) > 0;
  const semRecursos = semGeracoes || semImagens;
  const semPlanoPost = !isAdmin && hasPostPlano === false;
  const canGenerateCopy =
    !isNenhum &&
    !!data.keyInfo.trim() &&
    !loading &&
    !suggesting &&
    !copyLoading &&
    !semRecursos &&
    !(!isAdmin && semPlano) &&
    !semPlanoPost;
  const moodPendente = data.direcao === "mood" && !data.mood;
  const livreSemCopy = data.direcao === "livre" && !copy;
  const canGenerate = isNenhum
    ? !copy &&
      data.direcao === "livre" &&
      !loading &&
      !suggesting &&
      !copyLoading &&
      !semRecursos &&
      !(!isAdmin && semPlano) &&
      !semPlanoPost
    : (!!copy || data.direcao === "livre") &&
      !loading &&
      !suggesting &&
      !copyLoading &&
      !semRecursos &&
      !(!isAdmin && semPlano) &&
      !moodPendente &&
      !semPlanoPost &&
      (data.direcao === "livre" || !!data.keyInfo.trim());
  const hasLogo = !!kit.logoDataUrl;

  return (
    <section className="panel">
      <div className="sectionHeader">
        <div>
          <h2>Post Único</h2>
        </div>
      </div>

      {semPlanoPost && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Seu plano não inclui Post Único — fale com o admin para liberar.
        </div>
      )}

      <div className="grid2">
        <label>
          Nome da empresa
          <input
            value={data.companyName}
            readOnly
            tabIndex={-1}
            placeholder="Vem do Kit de Marca"
            style={{ background: "#f1f5f9", color: "#475569", cursor: "not-allowed" }}
          />
        </label>
        <label>
          Atividade principal
          <input
            value={data.mainActivity}
            readOnly
            tabIndex={-1}
            placeholder="Vem do Kit de Marca"
            style={{ background: "#f1f5f9", color: "#475569", cursor: "not-allowed" }}
          />
        </label>
      </div>

      <label>
        Público-alvo
        <select
          value={data.audience}
          onChange={(e) => update("audience", e.target.value as PostUnicoFormData["audience"])}
        >
          <option value="B2C">B2C — consumidor final</option>
          <option value="B2B">B2B — empresas/decisores</option>
        </select>
      </label>

      <div className="grid2">
        <label>
          Faixa etária do público
          <select
            value={data.faixaEtaria ?? ""}
            onChange={(e) =>
              update("faixaEtaria", (e.target.value || null) as FaixaEtaria | null)
            }
          >
            <option value="">Sem direcionamento</option>
            <option value="18-34">18 a 34 anos</option>
            <option value="35-49">35 a 49 anos</option>
            <option value="50-65">50 a 65 anos</option>
          </select>
        </label>
        <label>
          Gênero na imagem
          <select
            value={data.generoPref ?? ""}
            onChange={(e) =>
              update("generoPref", (e.target.value || null) as "M" | "F" | null)
            }
          >
            <option value="">Automático</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
        </label>
      </div>

      <div className="formatBox">
        <strong>Objetivo da peça</strong>
        <div className="sequenceGrid">
          {OBJETIVOS.map((o) => (
            <button
              key={o.code}
              type="button"
              className={`sequenceCard trackCard${data.objetivo === o.code ? " active" : ""}`}
              onClick={() => update("objetivo", o.code)}
            >
              <span className="sequenceNum">{o.label}</span>
              <span className="trackDescription">{o.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <PostUnicoKeyInfoSection
        keyInfo={data.keyInfo}
        onKeyInfoChange={(v) => update("keyInfo", v)}
        suggesting={suggesting}
        suggestions={suggestions}
        setSuggestions={setSuggestions}
        suggestError={suggestError}
        setSuggestError={setSuggestError}
        suggestCount={suggestCount}
        setSuggestCount={setSuggestCount}
        hasKeyInfo={hasKeyInfo}
        suggestExhausted={suggestExhausted}
        canClear={canClear}
        canRevertInitial={canRevertInitial}
        initialKeyInfo={initialKeyInfo}
        initialKeyInfoRef={initialKeyInfoRef}
        isAdmin={isAdmin}
        loading={loading}
        fetchSuggestion={fetchSuggestion}
        keyInfoCorrection={keyInfoCorrection}
        onOpenIdeias={() => setShowIdeiasPanel(true)}
        products={kit.products || []}
        selectedProducts={selectedProducts}
        setSelectedProducts={setSelectedProducts}
      />

      <CopySection
        copy={copy}
        setCopy={setCopy}
        copyOriginal={copyOriginal}
        copyLoading={copyLoading}
        copyError={copyError}
        copyTBusy={copyTBusy}
        copyXBusy={copyXBusy}
        copyTError={copyTError}
        copyXError={copyXError}
        copyTSuggs={copyTSuggs}
        setCopyTSuggs={setCopyTSuggs}
        copyXSuggs={copyXSuggs}
        setCopyXSuggs={setCopyXSuggs}
        fetchCopy={fetchCopy}
        regenField={regenField}
        clearCopy={clearCopy}
        isNenhum={isNenhum}
        direcao={data.direcao}
        canGenerateCopy={canGenerateCopy}
        isAdmin={isAdmin}
        copyTRegenCount={copyTRegenCount}
        copyXRegenCount={copyXRegenCount}
      />

      <DirecaoVisualSection
        direcao={data.direcao}
        mood={data.mood}
        isNenhum={isNenhum}
        setDirecao={setDirecao}
        onMoodChange={(code) => update("mood", code)}
      />

      <PostUnicoComposicaoVisual
        imageKit={imageKit}
        kit={kit}
        selection={visualSelection}
        onChange={onVisualSelectionChange}
        mood={data.direcao === "mood" ? data.mood : undefined}
        objetivo={data.objetivo}
        faixaEtaria={data.faixaEtaria}
        generoPref={data.generoPref}
      />

      {!hasLogo && (
        <p className="trackNote" style={{ marginBottom: 12 }}>
          Sem logomarca enviada. Use o painel <strong>Kit de Marca</strong> ao lado para enviar a
          logo — ela será aplicada automaticamente na posição escolhida (
          {kit.logoPosition === "top-center"
            ? "topo central"
            : kit.logoPosition === "bottom-center"
              ? "inferior central"
              : "canto inferior direito"}
          ).
        </p>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
        <button
          className="primaryBtn"
          type="button"
          onClick={() => onGenerate(copy || undefined)}
          disabled={!canGenerate}
          title={
            semPlanoPost
              ? "Você não tem plano de Post Único — fale com o admin"
              : !data.keyInfo.trim() && data.direcao !== "livre"
                ? "Preencha a informação-chave"
                : moodPendente
                  ? "Escolha um mood antes de gerar"
                  : data.direcao === "mood" && !copy
                    ? "Gere o título e o texto antes de gerar a peça (modo Mood)"
                    : semRecursos
                      ? "Limite do plano atingido — fale com o admin"
                      : !isAdmin && semPlano
                        ? "Sem plano ativo — fale com o admin"
                        : undefined
          }
          style={{ flex: 1 }}
        >
          {loading
            ? "Gerando peça..."
            : isNenhum
              ? "Gerar peça (texto livre)"
              : livreSemCopy
                ? "Gerar peça (texto livre)"
                : copy
                  ? "Gerar peça"
                  : "Gere o título e o texto primeiro"}
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={loading}
            style={{
              background: "#f8fafc",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "10px 20px",
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.55 : 1,
              whiteSpace: "nowrap",
            }}
          >
            Limpar Post Único
          </button>
        )}
      </div>
      <IdeiasSheet segment={kit.segment} open={showIdeiasPanel} onOpenChange={setShowIdeiasPanel} />
    </section>
  );
}
