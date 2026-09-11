// SELETOR DE TRILHA da montagem do Reels.
//
// ⚠ DUAS REGRAS DO ARI GOVERNAM ESTE COMPONENTE:
//
//  1. "PARA DE CRIAR MAIS AÇÕES DENTRO DO APP." Por isso ele nasce FECHADO, como
//     uma linha discreta. Quem não abrir nunca vai tropeçar nele, e a montagem
//     funciona igual — há uma trilha padrão.
//  2. "SÓ PARA QUEM TEM O PLANO CINEMÁTICO." Fora da trilha cinemática não existe
//     Reels, então oferecer a escolha seria oferecer algo sem uso.
//
// E o cliente NÃO envia música: escolhe de um acervo curado. Quem sobe arquivo
// próprio sobe música protegida, o Instagram silencia o post, e o problema volta
// para a agência. Ver src/domain/trilhas.config.ts.

import { useRef, useState } from "react";
import { TRILHAS, TRILHA_PADRAO_ID } from "../../../domain/trilhas.config";

interface Props {
  /** ID guardado no Kit. null/undefined = nunca escolheu (usa a padrão). */
  valor: string | null | undefined;
  onChange: (id: string) => void;
  salvando?: boolean;
}

export function TrilhaBlock({ valor, onChange, salvando }: Props) {
  const [aberto, setAberto] = useState(false);
  const [tocando, setTocando] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const escolhido = valor || TRILHA_PADRAO_ID;
  const atual = TRILHAS.find((t) => t.id === escolhido);
  const resumo = valor === "nenhuma" ? "sem música" : atual?.nome || "padrão";

  function ouvir(id: string, arquivo: string) {
    // Um player só: ouvir a segunda faixa para a primeira, como em qualquer
    // lugar que toca música.
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (tocando === id) {
      setTocando(null);
      return;
    }
    const a = new Audio(arquivo);
    a.volume = 0.7;
    a.onended = () => setTocando(null);
    void a.play().catch(() => setTocando(null));
    audioRef.current = a;
    setTocando(id);
  }

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 13,
          color: "#0f172a",
          fontWeight: 600,
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 11, color: "#94a3b8" }}>{aberto ? "▾" : "▸"}</span>
        🎵 Trilha do filme
        <span style={{ marginLeft: "auto", fontWeight: 500, fontSize: 12, color: "#64748b" }}>
          {resumo}
        </span>
      </button>

      {aberto && (
        <div style={{ marginTop: 8 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>
            Música de fundo do filme do Reels. Ela fica baixa enquanto a pessoa fala e sobe no
            fecho.
          </p>
          {TRILHAS.map((t) => {
            const ativo = escolhido === t.id && valor !== "nenhuma";
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  marginBottom: 6,
                  borderRadius: 8,
                  border: `1.5px solid ${ativo ? "#123a63" : "#e2e8f0"}`,
                  background: ativo ? "#f0f6ff" : "#fff",
                }}
              >
                <button
                  type="button"
                  onClick={() => ouvir(t.id, t.arquivo)}
                  title="Ouvir"
                  style={{
                    border: "none",
                    background: "#0f172a",
                    color: "#fff",
                    borderRadius: "50%",
                    width: 28,
                    height: 28,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {tocando === t.id ? "■" : "▶"}
                </button>
                <button
                  type="button"
                  onClick={() => onChange(t.id)}
                  disabled={salvando}
                  style={{
                    flex: 1,
                    border: "none",
                    background: "none",
                    textAlign: "left",
                    cursor: salvando ? "wait" : "pointer",
                    padding: 0,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: ativo ? 700 : 600, color: "#0f172a" }}>
                    {t.nome}
                  </span>
                  <br />
                  <span style={{ fontSize: 11, color: "#64748b" }}>{t.uso}</span>
                </button>
                {ativo && <span style={{ fontSize: 12, color: "#123a63" }}>✓</span>}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => onChange("nenhuma")}
            disabled={salvando}
            style={{
              border: `1.5px solid ${valor === "nenhuma" ? "#123a63" : "#e2e8f0"}`,
              background: valor === "nenhuma" ? "#f0f6ff" : "#fff",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 12,
              color: "#0f172a",
              cursor: salvando ? "wait" : "pointer",
              width: "100%",
              textAlign: "left",
            }}
          >
            Sem música — só a voz {valor === "nenhuma" ? "✓" : ""}
          </button>
        </div>
      )}
    </div>
  );
}
