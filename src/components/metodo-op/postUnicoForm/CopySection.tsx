// Bloco "Título e texto da peça" (copy) do Post Único — geração, edição,
// regeneração e correção de título/texto — extraído de PostUnicoForm.tsx
// (PLANO_V2 Fase 9.1). JSX e lógica movidos 1:1, sem mudança de
// comportamento.
import type { Dispatch, SetStateAction } from "react";
import type { PostUnicoDirecao, PostUnicoFormatoTexto, PostUnicoObjetivo } from "../../../types";
import type { PostUnicoCopy } from "../../../services/postUnico";
import { truncateWords, TITULO_MAX_WORDS } from "@/core/textValidation";
import { TOPICO_MAX_WORDS } from "@/core/topicoValidation";
import { countTituloWords } from "@/core/textWordUtils";
import { isOfertaConcreta } from "@/core/ofertaDetection";
import { useTextCorrection } from "@/hooks/useTextCorrection";

// Mesmo teto usado em generate-pu-copy.ts/regenerate-block.ts quando
// objetivo=promocao com oferta concreta detectada no keyInfo — o contador
// da UI precisa refletir o mesmo limite que o motor de geração usou.
const TITULO_MAX_WORDS_AJUSTADO = 9;

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

const COPY_REGEN_MAX = 2;

// Objetivos que aceitam o formato alternativo "tópicos com ícone" — mesmo
// conjunto documentado em PostUnicoFormatoTexto (types.ts).
export const TOPICOS_OBJETIVOS = new Set<PostUnicoObjetivo>([
  "institucional",
  "oportunidade",
  "promocao",
  "venda",
]);

interface Props {
  copy: PostUnicoCopy | null;
  setCopy: Dispatch<SetStateAction<PostUnicoCopy | null>>;
  copyOriginal: PostUnicoCopy | null;
  copyLoading: boolean;
  copyError: string | null;
  copyTBusy: boolean;
  copyXBusy: boolean;
  copyTError: string | null;
  copyXError: string | null;
  copyTSuggs: string[];
  setCopyTSuggs: Dispatch<SetStateAction<string[]>>;
  copyXSuggs: string[];
  setCopyXSuggs: Dispatch<SetStateAction<string[]>>;
  fetchCopy: () => void;
  regenField: (kind: "titulo" | "texto") => void;
  regenTopicos: () => void;
  clearCopy: (opts?: { resetCounter?: boolean }) => void;
  isNenhum: boolean;
  direcao: PostUnicoDirecao;
  canGenerateCopy: boolean;
  isAdmin: boolean;
  copyTRegenCount: number;
  copyXRegenCount: number;
  objetivo: PostUnicoObjetivo;
  keyInfo: string;
  formatoTexto?: PostUnicoFormatoTexto;
  onFormatoTextoChange: (v: PostUnicoFormatoTexto) => void;
}

export function CopySection({
  copy,
  setCopy,
  copyOriginal,
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
  fetchCopy,
  regenField,
  regenTopicos,
  clearCopy,
  isNenhum,
  direcao,
  canGenerateCopy,
  isAdmin,
  copyTRegenCount,
  copyXRegenCount,
  objetivo,
  keyInfo,
  formatoTexto,
  onFormatoTextoChange,
}: Props) {
  const wantsTopicos = TOPICOS_OBJETIVOS.has(objetivo);
  const copyTCorrection = useTextCorrection();
  const copyXCorrection = useTextCorrection();
  // Mesma heurística usada em generate-pu-copy.ts/regenerate-block.ts: título
  // ajustado (até 9 palavras) só em Promoção com oferta concreta no keyInfo.
  const tituloMaxWords =
    objetivo === "promocao" && isOfertaConcreta(keyInfo || "")
      ? TITULO_MAX_WORDS_AJUSTADO
      : TITULO_MAX_WORDS;

  return (
    <div
      className="formatBox"
      style={{
        borderColor: copy ? "#10b981" : isNenhum ? "#e2e8f0" : undefined,
        opacity: isNenhum ? 0.6 : 1,
      }}
    >
      <strong>
        Título e texto da peça{" "}
        {direcao === "livre" && !isNenhum && (
          <span style={{ fontWeight: 500, fontSize: 12, color: "#64748b" }}>
            (opcional no modo Livre)
          </span>
        )}
      </strong>
      <p style={{ margin: "4px 0 10px", fontSize: 12, color: isNenhum ? "#94a3b8" : "#64748b" }}>
        {isNenhum
          ? "No objetivo Nenhum a IA escreve o texto sozinha."
          : direcao === "livre"
            ? "Opcional no modo Livre. Se você gerar, esse título e texto vão aparecer escritos na imagem. Se pular, a IA decide o texto."
            : "A IA cria o título e o texto que vão aparecer escritos na peça. Confirme antes de gerar a imagem."}
      </p>

      {!copy && !copyLoading && wantsTopicos && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {(
            [
              { value: "corrido" as const, label: "Texto corrido" },
              { value: "topicos" as const, label: "Tópicos com ícone" },
            ] satisfies { value: PostUnicoFormatoTexto; label: string }[]
          ).map((opt) => {
            const active = (formatoTexto || "corrido") === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onFormatoTextoChange(opt.value)}
                style={{
                  background: active ? "#0f172a" : "#fff",
                  color: active ? "#fff" : "#0f172a",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {!copy && !copyLoading && (
        <button
          type="button"
          onClick={() => fetchCopy()}
          disabled={!canGenerateCopy}
          style={{
            background: "#0f172a",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 16px",
            fontWeight: 700,
            fontSize: 14,
            cursor: canGenerateCopy ? "pointer" : "not-allowed",
            opacity: canGenerateCopy ? 1 : 0.55,
          }}
        >
          {(formatoTexto || "corrido") === "topicos" && wantsTopicos
            ? "✨ Gerar título e tópicos"
            : "✨ Gerar título e texto"}
        </button>
      )}

      {copyLoading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Gerando título e texto…</p>
      )}

      {copyError && !copyLoading && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 10,
            marginBottom: 8,
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "#b91c1c" }}>{copyError}</p>
          <button
            type="button"
            onClick={() => fetchCopy()}
            style={{
              background: "none",
              border: "1px solid #fca5a5",
              color: "#b91c1c",
              borderRadius: 8,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </div>
      )}

      {copy && !copyLoading && (
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: 12,
          }}
        >
          {/* Título */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 4,
              }}
            >
              <span className="eyebrow" style={{ fontSize: 10, color: "#64748b" }}>
                Título
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: countTituloWords(copy.titulo) >= tituloMaxWords ? "#f59e0b" : "#94a3b8",
                }}
              >
                {countTituloWords(copy.titulo)}/{tituloMaxWords} palavras
              </span>
            </div>
            <input
              type="text"
              value={copy.titulo}
              onChange={(e) => setCopy((c) => (c ? { ...c, titulo: e.target.value } : c))}
              onBlur={(e) =>
                setCopy((c) =>
                  c ? { ...c, titulo: truncateWords(e.target.value, tituloMaxWords) } : c,
                )
              }
              style={{
                width: "100%",
                fontSize: 16,
                fontWeight: 800,
                color: "#0f172a",
                border: `1px solid ${countTituloWords(copy.titulo) >= tituloMaxWords ? "#fcd34d" : "#e2e8f0"}`,
                background: countTituloWords(copy.titulo) >= tituloMaxWords ? "#fffbeb" : "#fff",
                borderRadius: 6,
                padding: "6px 8px",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 6,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => regenField("titulo")}
                disabled={(!isAdmin && copyTRegenCount >= COPY_REGEN_MAX) || copyTBusy}
                style={{
                  background: "#fff",
                  color: "#0f172a",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: !isAdmin && copyTRegenCount >= COPY_REGEN_MAX ? "not-allowed" : "pointer",
                  opacity: !isAdmin && copyTRegenCount >= COPY_REGEN_MAX ? 0.55 : 1,
                }}
                title={
                  !isAdmin && copyTRegenCount >= COPY_REGEN_MAX
                    ? "Limite de 2 regenerações atingido"
                    : undefined
                }
              >
                {copyTBusy
                  ? "…"
                  : `✨ Gerar outro (${copyTRegenCount}/${isAdmin ? "∞" : COPY_REGEN_MAX})`}
              </button>
              <button
                type="button"
                onClick={() =>
                  copyTCorrection.correct(copy.titulo, (corrected) =>
                    setCopyTSuggs((s) => [...s, corrected]),
                  )
                }
                disabled={copyTCorrection.correcting || !copy.titulo.trim()}
                title="Corrige ortografia e gramática do título"
                style={{
                  background: "none",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#0f172a",
                  cursor:
                    copyTCorrection.correcting || !copy.titulo.trim() ? "not-allowed" : "pointer",
                  opacity: copyTCorrection.correcting || !copy.titulo.trim() ? 0.55 : 1,
                }}
              >
                {copyTCorrection.correcting ? "Corrigindo…" : "🔤 Corrigir português"}
              </button>
              {copyOriginal && copy.titulo !== copyOriginal.titulo && (
                <button
                  type="button"
                  onClick={() => {
                    setCopy((c) => (c ? { ...c, titulo: copyOriginal!.titulo } : c));
                    setCopyTSuggs([]);
                  }}
                  style={{
                    background: "#fff",
                    color: "#64748b",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ↺ Inicial
                </button>
              )}
              {copyTError && <span style={{ fontSize: 11, color: "#b91c1c" }}>{copyTError}</span>}
            </div>
            {copyTCorrection.msg && (
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#16a34a" }}>
                {copyTCorrection.msg}
              </p>
            )}
            {copyTCorrection.error && (
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#b91c1c" }}>
                {copyTCorrection.error}
              </p>
            )}
            {copyTSuggs.map((sugg, i) => (
              <div
                key={i}
                style={{
                  background: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "6px 10px",
                  marginTop: 6,
                  fontSize: 13,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontWeight: 700 }}>{sugg}</span>
                <button
                  type="button"
                  onClick={() => {
                    setCopy((c) => (c ? { ...c, titulo: sugg } : c));
                    setCopyTSuggs([]);
                  }}
                  style={{
                    background: "#0f172a",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Usar esta
                </button>
              </div>
            ))}
          </div>

          {/* Texto de apoio (formato corrido) — só quando não há tópicos */}
          {!copy.topicos?.length && (
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 4,
                }}
              >
                <span className="eyebrow" style={{ fontSize: 10, color: "#64748b" }}>
                  Texto de apoio
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: wordCount(copy.texto) >= 14 ? "#f59e0b" : "#94a3b8",
                  }}
                >
                  {wordCount(copy.texto)}/14 palavras
                </span>
              </div>
              <textarea
                value={copy.texto}
                onChange={(e) => setCopy((c) => (c ? { ...c, texto: e.target.value } : c))}
                onBlur={(e) =>
                  setCopy((c) => (c ? { ...c, texto: truncateWords(e.target.value, 14) } : c))
                }
                rows={2}
                style={{
                  width: "100%",
                  fontSize: 14,
                  color: "#334155",
                  border: `1px solid ${wordCount(copy.texto) >= 14 ? "#fcd34d" : "#e2e8f0"}`,
                  background: wordCount(copy.texto) >= 14 ? "#fffbeb" : "#fff",
                  borderRadius: 6,
                  padding: "6px 8px",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 6,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => regenField("texto")}
                  disabled={(!isAdmin && copyXRegenCount >= COPY_REGEN_MAX) || copyXBusy}
                  style={{
                    background: "#fff",
                    color: "#0f172a",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor:
                      !isAdmin && copyXRegenCount >= COPY_REGEN_MAX ? "not-allowed" : "pointer",
                    opacity: !isAdmin && copyXRegenCount >= COPY_REGEN_MAX ? 0.55 : 1,
                  }}
                  title={
                    !isAdmin && copyXRegenCount >= COPY_REGEN_MAX
                      ? "Limite de 2 regenerações atingido"
                      : undefined
                  }
                >
                  {copyXBusy
                    ? "…"
                    : `✨ Gerar outro (${copyXRegenCount}/${isAdmin ? "∞" : COPY_REGEN_MAX})`}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    copyXCorrection.correct(copy.texto, (corrected) =>
                      setCopyXSuggs((s) => [...s, corrected]),
                    )
                  }
                  disabled={copyXCorrection.correcting || !copy.texto.trim()}
                  title="Corrige ortografia e gramática do texto"
                  style={{
                    background: "none",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#0f172a",
                    cursor:
                      copyXCorrection.correcting || !copy.texto.trim() ? "not-allowed" : "pointer",
                    opacity: copyXCorrection.correcting || !copy.texto.trim() ? 0.55 : 1,
                  }}
                >
                  {copyXCorrection.correcting ? "Corrigindo…" : "🔤 Corrigir português"}
                </button>
                {copyOriginal && copy.texto !== copyOriginal.texto && (
                  <button
                    type="button"
                    onClick={() => {
                      setCopy((c) => (c ? { ...c, texto: copyOriginal!.texto } : c));
                      setCopyXSuggs([]);
                    }}
                    style={{
                      background: "#fff",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ↺ Inicial
                  </button>
                )}
                {copyXError && <span style={{ fontSize: 11, color: "#b91c1c" }}>{copyXError}</span>}
              </div>
              {copyXCorrection.msg && (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#16a34a" }}>
                  {copyXCorrection.msg}
                </p>
              )}
              {copyXCorrection.error && (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#b91c1c" }}>
                  {copyXCorrection.error}
                </p>
              )}
              {copyXSuggs.map((sugg, i) => (
                <div
                  key={i}
                  style={{
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "6px 10px",
                    marginTop: 6,
                    fontSize: 13,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>{sugg}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCopy((c) => (c ? { ...c, texto: sugg } : c));
                      setCopyXSuggs([]);
                    }}
                    style={{
                      background: "#0f172a",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "3px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Usar esta
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tópicos com ícone — substitui o texto de apoio corrido */}
          {!!copy.topicos?.length && (
            <div style={{ marginBottom: 10 }}>
              <span className="eyebrow" style={{ fontSize: 10, color: "#64748b" }}>
                Tópicos (o ícone de cada um é escolhido automaticamente)
              </span>
              {copy.topicos.map((topico, i) => (
                <div key={i} style={{ marginTop: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 11, color: "#64748b" }}>Tópico {i + 1}</span>
                    <span
                      style={{
                        fontSize: 10,
                        color: wordCount(topico.texto) >= TOPICO_MAX_WORDS ? "#f59e0b" : "#94a3b8",
                      }}
                    >
                      {wordCount(topico.texto)}/{TOPICO_MAX_WORDS} palavras
                    </span>
                  </div>
                  <input
                    type="text"
                    value={topico.texto}
                    onChange={(e) =>
                      setCopy((c) => {
                        if (!c?.topicos) return c;
                        const topicos = [...c.topicos];
                        topicos[i] = { ...topicos[i], texto: e.target.value };
                        return { ...c, topicos };
                      })
                    }
                    onBlur={(e) =>
                      setCopy((c) => {
                        if (!c?.topicos) return c;
                        const topicos = [...c.topicos];
                        topicos[i] = {
                          ...topicos[i],
                          texto: truncateWords(e.target.value, TOPICO_MAX_WORDS),
                        };
                        return { ...c, topicos };
                      })
                    }
                    style={{
                      width: "100%",
                      fontSize: 14,
                      color: "#334155",
                      border: `1px solid ${wordCount(topico.texto) >= TOPICO_MAX_WORDS ? "#fcd34d" : "#e2e8f0"}`,
                      background: wordCount(topico.texto) >= TOPICO_MAX_WORDS ? "#fffbeb" : "#fff",
                      borderRadius: 6,
                      padding: "6px 8px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
              <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={regenTopicos}
                  disabled={(!isAdmin && copyXRegenCount >= COPY_REGEN_MAX) || copyXBusy}
                  style={{
                    background: "#fff",
                    color: "#0f172a",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor:
                      !isAdmin && copyXRegenCount >= COPY_REGEN_MAX ? "not-allowed" : "pointer",
                    opacity: !isAdmin && copyXRegenCount >= COPY_REGEN_MAX ? 0.55 : 1,
                  }}
                  title={
                    !isAdmin && copyXRegenCount >= COPY_REGEN_MAX
                      ? "Limite de 2 regenerações atingido"
                      : undefined
                  }
                >
                  {copyXBusy
                    ? "…"
                    : `✨ Gerar outros tópicos (${copyXRegenCount}/${isAdmin ? "∞" : COPY_REGEN_MAX})`}
                </button>
                {copyXError && <span style={{ fontSize: 11, color: "#b91c1c" }}>{copyXError}</span>}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => clearCopy({ resetCounter: true })}
            style={{
              background: "#fff",
              color: "#94a3b8",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✕ Limpar e gerar novo
          </button>
        </div>
      )}
    </div>
  );
}
