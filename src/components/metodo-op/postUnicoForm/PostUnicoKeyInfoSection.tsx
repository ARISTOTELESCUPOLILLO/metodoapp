// Bloco "Informação-chave" do Post Único — botões Ideias/Sugestão/
// Corrigir/Limpar/Inicial, checklist de produtos, textarea e painel de
// sugestões — extraído de PostUnicoForm.tsx (PLANO_V2 Fase 9.1). JSX movido
// 1:1, sem mudança de comportamento. Ao contrário do KeyInfoSection do
// ContentForm.tsx (MOP), este NÃO possui estado próprio — todo o estado de
// sugestão continua no componente pai porque um único useEffect no pai
// reage a `data.keyInfo` tanto para resetar sugestões quanto para limpar o
// copy gerado (`clearCopy`), então o estado não pôde ser isolado sem
// duplicar esse efeito.
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useTextCorrection } from "@/hooks/useTextCorrection";
import ProductsChecklist from "../ProductsChecklist";

const SUGGEST_MAX = 3;

interface Props {
  keyInfo: string;
  onKeyInfoChange: (v: string) => void;
  suggesting: boolean;
  suggestions: string[];
  setSuggestions: Dispatch<SetStateAction<string[]>>;
  suggestError: string | null;
  setSuggestError: Dispatch<SetStateAction<string | null>>;
  suggestCount: number;
  setSuggestCount: Dispatch<SetStateAction<number>>;
  hasKeyInfo: boolean;
  suggestExhausted: boolean;
  canClear: boolean;
  canRevertInitial: boolean;
  initialKeyInfo: string | null;
  initialKeyInfoRef: MutableRefObject<string | null>;
  isAdmin: boolean;
  loading: boolean;
  fetchSuggestion: () => void;
  keyInfoCorrection: ReturnType<typeof useTextCorrection>;
  onOpenIdeias: () => void;
  products: string[];
  selectedProducts: string[];
  setSelectedProducts: (next: string[]) => void;
}

export function PostUnicoKeyInfoSection({
  keyInfo,
  onKeyInfoChange,
  suggesting,
  suggestions,
  setSuggestions,
  suggestError,
  setSuggestError,
  suggestCount,
  setSuggestCount,
  hasKeyInfo,
  suggestExhausted,
  canClear,
  canRevertInitial,
  initialKeyInfo,
  initialKeyInfoRef,
  isAdmin,
  loading,
  fetchSuggestion,
  keyInfoCorrection,
  onOpenIdeias,
  products,
  selectedProducts,
  setSelectedProducts,
}: Props) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <label style={{ margin: 0 }}>
          Informação-chave <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                  : "Sorteia categoria e sugere uma Informação-chave"
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
              keyInfoCorrection.correct(keyInfo || "", (corrected) => {
                if (initialKeyInfoRef.current === null) initialKeyInfoRef.current = keyInfo || "";
                onKeyInfoChange(corrected);
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
              onKeyInfoChange("");
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
              onClick={() => onKeyInfoChange(initialKeyInfo ?? "")}
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
        value={keyInfo}
        onChange={(e) => onKeyInfoChange(e.target.value)}
        placeholder="Ex.: 30% de desconto em todos os tratamentos clareadores até sexta-feira."
        rows={4}
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
                    ? "Sugestões OP"
                    : "Sugestão OP"}
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
                          initialKeyInfoRef.current = keyInfo || "";
                        onKeyInfoChange(sugg);
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
                    disabled={hasKeyInfo}
                    style={{
                      background: "#fff",
                      color: "#0f172a",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      padding: "6px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: hasKeyInfo ? "not-allowed" : "pointer",
                      opacity: hasKeyInfo ? 0.4 : 1,
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
