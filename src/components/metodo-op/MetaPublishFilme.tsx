// PUBLICAR O FILME MONTADO — Instagram (reels) e Facebook (vídeo da página).
//
// ⚠ COMPONENTE SEPARADO DO MetaPublish, de propósito. O de imagem publica em uma
// chamada e tem quatro caminhos (OAuth, devMode, carrossel, foto). Vídeo tem um
// caminho só, mas TEM ESPERA: a Meta processa o arquivo antes de deixar publicar.
// Enfiar isso no componente de foto obrigaria a misturar dois fluxos de estado
// que não se parecem.
//
// ⚠ E ANTES DE QUALQUER COISA, O FILME PRECISA DE ENDEREÇO. Ele nasce dentro do
// navegador; a Meta BUSCA o vídeo num endereço público. Por isso o primeiro
// passo é subir (ver /api/salvar-filme) — e o endereço resultante é reaproveitado
// pelas duas redes, para não subir o mesmo arquivo duas vezes.

import { useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useImpersonation } from "../../hooks/useImpersonation";
import { getMetaDestino } from "@/lib/metaAllowlist";
import { supabase } from "@/integrations/supabase/client";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type Estado = "idle" | "enviando" | "ok" | "erro";

interface Props {
  /** O filme montado, como está no navegador. */
  blob?: Blob | null;
  /** Ou um endereço público que já exista (peça arquivada). */
  videoUrl?: string | null;
  caption?: string;
  titulo?: string;
}

export function MetaPublishFilme({ blob, videoUrl, caption, titulo }: Props) {
  const { user } = useAuth();
  // Mesma trava do MetaPublish: em "Atuar como", quem publica é o token de quem
  // está LOGADO. Se o destino do dono da peça não for o mesmo, os botões somem —
  // publicação é irreversível e sair na conta errada não tem desfazer.
  const impersonation = useImpersonation();
  const destinoLogado = getMetaDestino(user?.email);
  const destinoDono = impersonation ? getMetaDestino(impersonation.email) : destinoLogado;
  const podePublicar = !!destinoLogado && destinoLogado.pageId === destinoDono?.pageId;

  const [ig, setIg] = useState<Estado>("idle");
  const [fb, setFb] = useState<Estado>("idle");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  // Guardado entre tentativas: quando a Meta ainda está processando, o contêiner
  // já existe e a segunda tentativa publica sem reprocessar o vídeo.
  const [creationId, setCreationId] = useState<string | null>(null);
  // REF, nao estado: e so memoria do envio, nada na tela depende dela, e assim
  // ela nao nasce congelada com o valor da primeira renderizacao.
  const urlEnviada = useRef<string | null>(null);

  if (!podePublicar) return null;
  if (!blob && !videoUrl) return null;

  /** Sobe o filme uma vez e reaproveita o endereço nas duas redes. */
  async function garantirEndereco(): Promise<string> {
    // Um endereco JA PRONTO vence: o card do Reels ja subiu o filme, e a peca
    // arquivada ja mora num endereco. So sobe quando nao existe nenhum.
    if (videoUrl) return videoUrl;
    if (urlEnviada.current) return urlEnviada.current;
    if (!blob) throw new Error("sem filme para publicar");
    const res = await fetch("/api/salvar-filme", {
      method: "POST",
      headers: { "Content-Type": "video/mp4", ...(await authHeader()) },
      body: blob,
    });
    const j = (await res.json()) as { url?: string; error?: string };
    if (!j.url) throw new Error(j.error || "não foi possível preparar o filme");
    urlEnviada.current = j.url;
    return j.url;
  }

  async function publicarInstagram() {
    setIg("enviando");
    setErro("");
    setAviso("");
    try {
      const url = await garantirEndereco();
      const res = await fetch("/api/meta/publish-reels", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ videoUrl: url, caption: caption || "", creationId }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        creationId?: string;
        aindaProcessando?: boolean;
      };
      if (j.ok) {
        setIg("ok");
        setCreationId(null);
        return;
      }
      // So guarda o conteiner quando ele ainda serve. O servidor nao devolve o
      // id de um conteiner rejeitado — e se devolvesse, guardar prenderia o
      // usuario esperando por algo que nao vai mudar.
      setCreationId(j.aindaProcessando ? j.creationId || null : null);
      if (j.aindaProcessando) {
        // Não é erro: é o vídeo ainda em processamento do lado da Meta.
        setIg("idle");
        setAviso(j.error || "A Meta ainda está processando. Clique de novo em um minuto.");
        return;
      }
      throw new Error(j.error || "falha ao publicar");
    } catch (e) {
      setIg("erro");
      setErro((e as Error)?.message || "falha ao publicar");
    }
  }

  async function publicarFacebook() {
    setFb("enviando");
    setErro("");
    try {
      const url = await garantirEndereco();
      const res = await fetch("/api/meta/publish-facebook-video", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ videoUrl: url, text: caption || "", titulo }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error || "falha ao publicar");
      setFb("ok");
    } catch (e) {
      setFb("erro");
      setErro((e as Error)?.message || "falha ao publicar");
    }
  }

  const botao = (cor: string): React.CSSProperties => ({
    flex: 1,
    border: "none",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    background: cor,
    cursor: "pointer",
  });

  const rotulo = (e: Estado, nome: string) =>
    e === "enviando" ? "Publicando…" : e === "ok" ? "✓ Publicado" : nome;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>
        PUBLICAR O FILME
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={publicarInstagram}
          disabled={ig === "enviando" || ig === "ok"}
          style={botao(ig === "ok" ? "#16a34a" : "#c13584")}
        >
          {rotulo(ig, "Instagram (Reels)")}
        </button>
        <button
          type="button"
          onClick={publicarFacebook}
          disabled={fb === "enviando" || fb === "ok"}
          style={botao(fb === "ok" ? "#16a34a" : "#1877f2")}
        >
          {rotulo(fb, "Facebook")}
        </button>
      </div>
      {aviso && <div style={{ marginTop: 6, fontSize: 11, color: "#92400e" }}>{aviso}</div>}
      {erro && <div style={{ marginTop: 6, fontSize: 11, color: "#b91c1c" }}>{erro}</div>}
      <div style={{ marginTop: 6, fontSize: 10, color: "#94a3b8" }}>
        O vídeo é enviado para a Meta, que leva alguns segundos processando antes de publicar.
      </div>
    </div>
  );
}
