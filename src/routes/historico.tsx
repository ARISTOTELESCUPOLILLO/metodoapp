import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Trash2, Copy, FileText, Play } from "lucide-react";
import { TopBar } from "@/components/app/TopBar";
import { AuthGate } from "@/components/app/AuthGate";
import { listMyGenerations, deleteGeneration } from "@/lib/assets.functions";
import { useImpersonation } from "@/hooks/useImpersonation";
import { MetaPublish } from "@/components/metodo-op/MetaPublish";
import { archiveFileName } from "@/utils/file";

export const Route = createFileRoute("/historico")({
  component: () => (
    <AuthGate>
      <HistoricoPage />
    </AuthGate>
  ),
});

type Gen = Awaited<ReturnType<typeof listMyGenerations>>[number];

const SLOT_LABEL: Record<string, string> = {
  plano1: "Plano 1",
  plano2: "Plano 2",
  bonus: "Bônus",
};

const FORMATO_LABEL: Record<string, string> = {
  estatico: "Estático",
  carrossel: "Carrossel",
  estatico_final: "Estático Final",
  reels: "Reels",
};

function diasRestantes(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function HistoricoPage() {
  const impersonation = useImpersonation();
  const fetchList = useServerFn(listMyGenerations);
  const removeFn = useServerFn(deleteGeneration);
  const qc = useQueryClient();
  const asUserId = impersonation?.userId;
  const { data, isLoading, error } = useQuery({
    queryKey: ["historico", asUserId ?? "self"],
    queryFn: () => fetchList({ data: asUserId ? { asUserId } : undefined }),
  });
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id, ...(asUserId ? { asUserId } : {}) } }),
    onSuccess: () => {
      setConfirmId(null);
      qc.invalidateQueries({ queryKey: ["historico", asUserId ?? "self"] });
    },
  });

  // Agrupa por data de arquivamento (mais recente primeiro), e dentro do dia ordena por created_at ASC
  const byDay = new Map<string, Gen[]>();
  for (const g of data || []) {
    const k = formatDate(g.createdAt);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(g);
  }
  const days = Array.from(byDay.entries()).map(([day, items]) => {
    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return { day, items };
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <TopBar />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px" }}>
        <header style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24, color: "#0f172a" }}>Histórico de gerações</h1>
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) window.history.back();
                else window.location.href = "/";
              }}
              style={{
                marginLeft: "auto",
                background: "#f8fafc",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
              title="Voltar para a página anterior"
            >
              ✕ Fechar
            </button>
          </div>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
            Seu histórico guarda até 48 imagens e 6 vídeos (reels) no total. Passando disso, a
            geração mais antiga é apagada automaticamente para abrir espaço. Arquivos somem depois
            de 30 dias, mesmo sem passar do limite.
          </p>
          {impersonation && (
            <div
              style={{
                marginTop: 12,
                background: "#dbeafe",
                border: "1px solid #93c5fd",
                color: "#1e3a8a",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 14,
              }}
            >
              👤 Vendo histórico de <strong>{impersonation.nome}</strong> ({impersonation.email}).
              Toda exclusão é feita na conta dele.
            </div>
          )}
        </header>

        {isLoading && <p>Carregando…</p>}
        {error && <p style={{ color: "#b91c1c" }}>Erro ao carregar histórico.</p>}

        {!isLoading && !error && days.length === 0 && (
          <p style={{ color: "#64748b", fontSize: 14 }}>
            Nenhuma geração arquivada ainda. Use o botão "Arquivar" em cada box após gerar uma
            sequência.
          </p>
        )}

        {days.map((d) => (
          <section key={d.day} style={{ marginTop: 24 }}>
            <h2
              style={{
                fontSize: 16,
                color: "#0f172a",
                margin: "0 0 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              📅 {d.day}
            </h2>
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              }}
            >
              {d.items.map((g) => (
                <GenerationCard key={g.id} gen={g} onAskDelete={setConfirmId} />
              ))}
            </div>
          </section>
        ))}

        {confirmId && (
          <ConfirmDialog
            onCancel={() => setConfirmId(null)}
            onConfirm={() => mut.mutate(confirmId)}
            loading={mut.isPending}
          />
        )}
      </main>
    </div>
  );
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadFromUrl(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function GenerationCard({ gen, onAskDelete }: { gen: Gen; onAskDelete: (id: string) => void }) {
  const dias = diasRestantes(gen.expiresAt);
  const expiraSoon = dias <= 5;
  const formatoLabel = FORMATO_LABEL[gen.formato] || gen.formato;
  const dayLabel =
    gen.tipo === "PU"
      ? `Post Único — ${formatoLabel}`
      : gen.dia
        ? `Dia ${gen.dia} — ${formatoLabel}`
        : formatoLabel;
  const [copied, setCopied] = useState(false);

  async function copyLegenda() {
    try {
      await navigator.clipboard.writeText(gen.legenda || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback noop
    }
  }

  return (
    <article
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: 10,
        boxShadow: "0 1px 3px rgba(15,23,42,.08)",
        border: "1px solid #e2e8f0",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <strong style={{ fontSize: 13, color: "#0f172a" }}>{dayLabel}</strong>
          <span style={{ fontSize: 11, color: "#64748b" }}>{SLOT_LABEL[gen.slot]}</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11 }}>
          <span
            style={{
              background: expiraSoon ? "#fde68a" : "#e0f2fe",
              color: expiraSoon ? "#78350f" : "#0c4a6e",
              padding: "2px 6px",
              borderRadius: 6,
              fontWeight: 600,
            }}
          >
            {dias}d
          </span>
          <button
            type="button"
            onClick={() => onAskDelete(gen.id)}
            title="Excluir"
            style={{
              background: "#fee2e2",
              color: "#b91c1c",
              border: "none",
              padding: 6,
              borderRadius: 8,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </header>

      {/* Imagens */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            gen.assets.length === 1 ? "1fr" : "repeat(auto-fill, minmax(80px, 1fr))",
          gap: 6,
          justifyItems: gen.assets.length === 1 ? "center" : "stretch",
        }}
      >
        {gen.assets.map((a) => {
          const isSingleReels = gen.assets.length === 1 && gen.formato === "reels";
          const isSingle = gen.assets.length === 1;
          return (
            <div
              key={a.id}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: isSingleReels ? 140 : isSingle ? 200 : "100%",
              }}
            >
              <img
                src={a.url}
                alt={`Imagem ${a.ordem}`}
                style={{
                  width: "100%",
                  aspectRatio: isSingleReels ? "9 / 16" : "1 / 1",
                  objectFit: "cover",
                  borderRadius: 8,
                  background: "#f1f5f9",
                }}
              />
              <button
                type="button"
                title="Baixar imagem"
                onClick={() =>
                  downloadFromUrl(
                    a.url,
                    archiveFileName({
                      tipo: gen.tipo,
                      slot: gen.slot,
                      formato: gen.formato,
                      createdAt: gen.createdAt,
                      numero: a.ordem,
                      ext: "webp",
                    }),
                  )
                }
                style={{
                  position: "absolute",
                  bottom: 4,
                  right: 4,
                  background: "rgba(15,23,42,.85)",
                  color: "#fff",
                  padding: 4,
                  borderRadius: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Download size={11} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Vídeo (reels) */}
      {gen.videoUrl && (
        <div
          style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          <video
            src={gen.videoUrl}
            controls
            style={{
              width: "100%",
              maxWidth: 180,
              maxHeight: 280,
              background: "#000",
              borderRadius: 8,
            }}
          />
          <button
            type="button"
            onClick={() =>
              downloadFromUrl(
                gen.videoUrl!,
                archiveFileName({
                  tipo: gen.tipo,
                  slot: gen.slot,
                  formato: gen.formato,
                  createdAt: gen.createdAt,
                  ext: "mp4",
                }),
              )
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "#0f172a",
              color: "#fff",
              border: "none",
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              marginTop: 6,
              cursor: "pointer",
            }}
          >
            <Download size={11} /> MP4
          </button>
        </div>
      )}

      {/* Legenda */}
      {gen.legenda && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>
            Legenda
          </div>
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 11,
              color: "#0f172a",
              whiteSpace: "pre-wrap",
              maxHeight: 110,
              overflowY: "auto",
            }}
          >
            {gen.legenda}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              type="button"
              onClick={copyLegenda}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: copied ? "#16a34a" : "#0f172a",
                color: "#fff",
                border: "none",
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Copy size={12} /> {copied ? "Copiado!" : "Copiar legenda"}
            </button>
            <button
              type="button"
              onClick={() =>
                downloadText(
                  archiveFileName({
                    tipo: gen.tipo,
                    slot: gen.slot,
                    formato: gen.formato,
                    createdAt: gen.createdAt,
                    ext: "txt",
                  }),
                  gen.legenda,
                )
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "#f8fafc",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <FileText size={12} /> Baixar .txt
            </button>
          </div>
        </div>
      )}

      {/* Publicar no Meta — reels fica de fora de propósito: o asset arquivado
          de um reels é a capa PNG, não o vídeo. Publicar aqui postaria a capa
          como foto estática no lugar do reels. */}
      {gen.assets.length > 0 && gen.formato !== "reels" && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
          {gen.formato === "carrossel" && gen.assets.length >= 2 ? (
            <MetaPublish
              imageDataUrls={[...gen.assets].sort((a, b) => a.ordem - b.ordem).map((a) => a.url)}
              caption={gen.legenda}
            />
          ) : (
            <MetaPublish imageDataUrl={gen.assets[0].url} caption={gen.legenda} />
          )}
        </div>
      )}
    </article>
  );
}

function ConfirmDialog({
  onCancel,
  onConfirm,
  loading,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div
      role="dialog"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 14, padding: 22, maxWidth: 380, width: "90%" }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#0f172a" }}>Excluir este box?</h3>
        <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 14 }}>
          Esta ação remove as imagens, o vídeo e a legenda deste box. Não é possível desfazer.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "none",
              background: "#b91c1c",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {loading ? "Excluindo…" : "Excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}
