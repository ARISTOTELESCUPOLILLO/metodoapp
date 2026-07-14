// Bloco "Informação-chave" do formulário de conteúdo do Método OP — botões
// Ideias/Sugestão/Corrigir/Limpar/Inicial, checklist de produtos, textarea e
// painel de sugestões — extraído de ContentForm.tsx (PLANO_V2 Fase 9.1).
// JSX e lógica movidos 1:1, sem mudança de comportamento.
import { useEffect, useRef, useState } from "react";
import { ContentFormData, Segment } from "../../../types";
import { getAuthHeaders } from "../../../services/authHeaders";
import ProductsChecklist from "../ProductsChecklist";
import { useTextCorrection } from "@/hooks/useTextCorrection";
import { usePlanSlotsCtx } from "../../../contexts/PlanSlotsContext";
import { useAuth } from "../../../hooks/useAuth";
import { useImpersonation } from "../../../hooks/useImpersonation";
import { loadSugestaoHistory, pushSugestaoHistory } from "../../../utils/storage";

const KEYINFO_EXAMPLE: Record<Segment, string> = {
  SERVIÇOS:
    "Ex.: tráfego pago para lojas locais que impulsionam mas não convertem em vendas constantes",
  VAREJO:
    "Ex.: loja de roupas de bairro que quer transformar o Instagram em vitrine que vende todo dia",
  MARCA:
    "Ex.: marca consolidada pronta para ganhar autoridade e dar o próximo passo de posicionamento",
};

const SUGGEST_MAX = 3;

interface Props {
  data: ContentFormData;
  update: <K extends keyof ContentFormData>(key: K, value: ContentFormData[K]) => void;
  segment: Segment;
  isPersonalBrand?: boolean;
  products: string[];
  selectedProducts: string[];
  setSelectedProducts: (next: string[]) => void;
  loading: boolean;
  isAdmin: boolean;
  onOpenIdeias: () => void;
}

export function KeyInfoSection({
  data,
  update,
  segment,
  isPersonalBrand,
  products,
  selectedProducts,
  setSelectedProducts,
  loading,
  isAdmin,
  onOpenIdeias,
}: Props) {
  const { selectedSlot } = usePlanSlotsCtx();
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestCount, setSuggestCount] = useState(0);
  const initialKeyInfoRef = useRef<string | null>(null);
  const allSessionSuggestionsRef = useRef<string[]>([]);
  // Semente fixa por sessão de sugestões — enviada ao servidor (stateless) pra
  // garantir que as tentativas 0/1/2 caiam em lentes diferentes dentro da
  // sessão, mas variem entre sessões novas (ver lensIndex em suggest-keyinfo.ts).
  const sessionSeedRef = useRef<number>(Math.floor(Math.random() * 1e9));
  const keyInfoCorrection = useTextCorrection();
  const { user } = useAuth();
  const impersonation = useImpersonation();
  const effectiveUserId = impersonation?.userId ?? user?.id;

  const hasKeyInfo = !!(data.keyInfo || "").trim();
  const suggestExhausted = !isAdmin && suggestCount >= SUGGEST_MAX;
  const canClear = hasKeyInfo || suggestCount > 0;
  const initialKeyInfo = initialKeyInfoRef.current;
  const canRevertInitial = initialKeyInfo !== null && data.keyInfo !== initialKeyInfo;

  useEffect(() => {
    setSuggestCount(0);
    setSuggestions([]);
    setSuggestError(null);
    initialKeyInfoRef.current = null;
    allSessionSuggestionsRef.current = [];
    sessionSeedRef.current = Math.floor(Math.random() * 1e9);
  }, [segment]);

  // Semeia o rodízio sintático com o histórico de rodadas ANTERIORES (outra
  // visita/mount, não só cliques dentro deste carregamento de página) — sem
  // isso, checkRepeatedOpening só compara sugestões da mesma sessão de
  // página (achado 14/07/2026). Guard evita re-semear a cada render.
  // Declarado DEPOIS do reset por `[segment]` de propósito: no mesmo commit
  // de montagem, efeitos rodam na ordem em que aparecem no componente — se
  // viesse antes, o reset por segmento (que roda incondicionalmente no
  // mount) apagaria a semeadura no mesmo ciclo.
  const historySeededRef = useRef(false);
  useEffect(() => {
    if (historySeededRef.current || !effectiveUserId) return;
    historySeededRef.current = true;
    allSessionSuggestionsRef.current = [
      ...loadSugestaoHistory(effectiveUserId),
      ...allSessionSuggestionsRef.current,
    ];
  }, [effectiveUserId]);

  useEffect(() => {
    if (!data.keyInfo) {
      setSuggestions([]);
      setSuggestError(null);
      initialKeyInfoRef.current = null;
      // suggestCount e allSessionSuggestionsRef NÃO são resetados — preservam
      // o rodízio de produto/lente entre pedidos de sugestão
    }
  }, [data.keyInfo]);

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
          companyName: data.companyName,
          mainActivity: data.mainActivity || "",
          objetivo: "promocao",
          segment,
          isPersonalBrand,
          audience: data.audience,
          hint: "",
          mode: "metodo",
          attempt,
          sessionSeed: sessionSeedRef.current,
          subMode: "sugerir",
          previousSuggestions: allSessionSuggestionsRef.current,
          brandVoice: data.brandVoice || "",
          selectedProducts,
          preferredSlot: selectedSlot,
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
        pushSugestaoHistory(newSugg, effectiveUserId);
      }
      setSuggestCount((c) => c + 1);
    } catch (e) {
      setSuggestError((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span>Informação-chave</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={onOpenIdeias}
            title="Ver sugestões de assuntos para este segmento"
            style={{
              background: "none",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: "#0f172a",
              cursor: "pointer",
            }}
          >
            💡 Ideias
          </button>
          <button
            type="button"
            onClick={fetchSuggestion}
            disabled={suggesting || loading || hasKeyInfo || suggestExhausted}
            title={
              hasKeyInfo
                ? "Limpe o campo para usar Sugestão"
                : suggestExhausted
                  ? "Limite atingido"
                  : "Sugere um assunto pronto para você editar"
            }
            style={{
              background: "none",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: "#0f172a",
              cursor:
                suggesting || loading || hasKeyInfo || suggestExhausted ? "not-allowed" : "pointer",
              opacity: suggesting || loading || hasKeyInfo || suggestExhausted ? 0.4 : 1,
            }}
          >
            {suggesting
              ? "Gerando…"
              : `✨ Sugestão${suggestCount > 0 ? ` (${suggestCount}/${isAdmin ? "∞" : SUGGEST_MAX})` : ""}`}
          </button>
          <button
            type="button"
            onClick={() =>
              keyInfoCorrection.correct(data.keyInfo || "", (corrected) => {
                if (initialKeyInfoRef.current === null)
                  initialKeyInfoRef.current = data.keyInfo || "";
                update("keyInfo", corrected);
              })
            }
            disabled={keyInfoCorrection.correcting || !hasKeyInfo}
            title="Corrige ortografia e gramática do texto"
            style={{
              background: "none",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: "#0f172a",
              cursor: keyInfoCorrection.correcting || !hasKeyInfo ? "not-allowed" : "pointer",
              opacity: keyInfoCorrection.correcting || !hasKeyInfo ? 0.4 : 1,
            }}
          >
            {keyInfoCorrection.correcting ? "Corrigindo…" : "🔤 Corrigir"}
          </button>
          <button
            type="button"
            onClick={() => {
              update("keyInfo", "");
              setSuggestCount(0);
              setSuggestions([]);
              setSuggestError(null);
              initialKeyInfoRef.current = null;
            }}
            disabled={!canClear}
            title="Limpar texto e reiniciar"
            style={{
              background: "none",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: "#0f172a",
              cursor: !canClear ? "not-allowed" : "pointer",
              opacity: !canClear ? 0.4 : 1,
            }}
          >
            🗑 Limpar
          </button>
          {canRevertInitial && (
            <button
              type="button"
              onClick={() => update("keyInfo", initialKeyInfo ?? "")}
              title="Voltar ao texto inicial"
              style={{
                background: "none",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 600,
                color: "#0f172a",
                cursor: "pointer",
              }}
            >
              ↺ Inicial
            </button>
          )}
        </div>
      </div>
      <ProductsChecklist
        products={products || []}
        selected={selectedProducts}
        onChange={setSelectedProducts}
      />
      <textarea
        value={data.keyInfo || ""}
        onChange={(e) => update("keyInfo", e.target.value)}
        placeholder={KEYINFO_EXAMPLE[segment]}
        rows={3}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 10,
          border: `1px solid ${suggestExhausted ? "#fcd34d" : "#e2e8f0"}`,
          fontFamily: "inherit",
          fontSize: 14,
          lineHeight: 1.45,
          resize: "vertical",
          minHeight: 84,
          background: suggestExhausted ? "#fffbeb" : "#fff",
          color: "#0f172a",
        }}
      />
      {keyInfoCorrection.msg && (
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#16a34a" }}>{keyInfoCorrection.msg}</p>
      )}
      {keyInfoCorrection.error && (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#b91c1c" }}>
          {keyInfoCorrection.error}
        </p>
      )}
      {(suggesting || suggestions.length > 0 || suggestError) && (
        <div
          style={{
            marginTop: 10,
            padding: 14,
            borderRadius: 12,
            background: suggestError ? "#fef2f2" : "#f8fafc",
            border: `1px solid ${suggestError ? "#fecaca" : "#e2e8f0"}`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span className="eyebrow" style={{ color: suggestError ? "#b91c1c" : "#0f172a" }}>
              {suggesting
                ? "Gerando sugestão…"
                : suggestError
                  ? "Erro"
                  : suggestions.length > 1
                    ? "Sugestões"
                    : "Sugestão"}
            </span>
            {!suggesting && (
              <button
                type="button"
                onClick={() => {
                  setSuggestions([]);
                  setSuggestError(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 18,
                  cursor: "pointer",
                  color: "#64748b",
                  padding: 0,
                  lineHeight: 1,
                }}
                aria-label="Fechar"
              >
                ×
              </button>
            )}
          </div>
          {suggesting && (
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Aguarde alguns segundos…</p>
          )}
          {!suggesting && suggestError && (
            <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{suggestError}</p>
          )}
          {!suggesting && !suggestError && suggestions.length > 0 && (
            <div>
              {suggestions.length > 1 && (
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>
                  Compare e escolha a que preferir.
                </p>
              )}
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns:
                    suggestions.length > 1 ? "repeat(auto-fit, minmax(220px, 1fr))" : "1fr",
                }}
              >
                {suggestions.map((sugg, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {suggestions.length > 1 && (
                      <span className="eyebrow" style={{ fontSize: 10, color: "#64748b" }}>
                        Sugestão {idx + 1}
                      </span>
                    )}
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: "#0f172a",
                        flex: 1,
                      }}
                    >
                      {sugg}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (initialKeyInfoRef.current === null)
                          initialKeyInfoRef.current = data.keyInfo || "";
                        update("keyInfo", sugg);
                        setSuggestions([]);
                      }}
                      style={{
                        background: "#0f172a",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 14px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        alignSelf: "flex-start",
                      }}
                    >
                      Usar esta
                    </button>
                  </div>
                ))}
              </div>
              {!suggestExhausted && (
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={fetchSuggestion}
                    disabled={suggesting || hasKeyInfo}
                    style={{
                      background: "#fff",
                      color: "#0f172a",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      padding: "6px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: suggesting || hasKeyInfo ? "not-allowed" : "pointer",
                      opacity: suggesting || hasKeyInfo ? 0.4 : 1,
                    }}
                  >
                    Gerar outra ({suggestCount}/{isAdmin ? "∞" : SUGGEST_MAX})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
