import { useRef, useState } from "react";
import { ImageKit } from "../../types";
import { resizeImage, validateImageFile } from "../../utils/imageResize";
import { PRODUTO_SLOTS, CENARIO_SLOTS } from "../../utils/imageKitStorage";
import { VoiceBlock } from "./imageKitForm/VoiceBlock";

interface Props {
  kit: ImageKit;
  onChange: (next: ImageKit) => void;
  onSave: () => void;
  saving?: boolean;
  saved?: boolean;
}

type SlotKind =
  | "avatar"
  | "avatar2"
  | "fachada"
  | "fato"
  | "venda"
  | { tipo: "cenario"; index: number }
  | { tipo: "produto"; index: number };

export default function ImageKitForm({ kit, onChange, onSave, saving, saved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busySlot, setBusySlot] = useState<string | null>(null);

  async function handleFile(slot: SlotKind, file: File) {
    setError(null);
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    const slotId = slotKey(slot);
    setBusySlot(slotId);
    try {
      const dataUrl = await resizeImage(file, {
        maxSide: 768,
        quality: 0.85,
        mimeType: "image/webp",
      });
      applySlot(slot, dataUrl);
    } catch (e) {
      setError((e as Error).message || "Falha ao processar a imagem.");
    } finally {
      setBusySlot(null);
    }
  }

  function applySlot(slot: SlotKind, dataUrl: string | null) {
    if (slot === "avatar") {
      onChange({ ...kit, avatar: dataUrl || undefined });
    } else if (slot === "avatar2") {
      onChange({ ...kit, avatar2: dataUrl || undefined });
    } else if (slot === "fachada") {
      onChange({ ...kit, fachada: dataUrl || undefined });
    } else if (slot === "fato") {
      onChange({ ...kit, fato: dataUrl || undefined });
    } else if (slot === "venda") {
      onChange({ ...kit, venda: dataUrl || undefined });
    } else if (slot.tipo === "cenario") {
      const next = [...kit.cenarios];
      next[slot.index] = dataUrl;
      onChange({ ...kit, cenarios: next });
    } else {
      const next = [...kit.produtos];
      next[slot.index] = dataUrl;
      onChange({ ...kit, produtos: next });
    }
  }

  function clearSlot(slot: SlotKind) {
    setError(null);
    applySlot(slot, null);
  }

  return (
    <section className="panel">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Biblioteca visual</span>
          <h2>Kit Imagem</h2>
        </div>
      </div>
      <p style={{ margin: "-4px 0 14px", fontSize: 13, color: "#475569" }}>
        Suba imagens próprias para orientar a criação visual das peças. Essas imagens ajudam a IA a
        entender pessoas, produtos e ambientes da sua marca. Aceita JPG, PNG ou WEBP — até 5 MB
        cada.
      </p>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: 10,
            borderRadius: 10,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div className="formatBox">
        <strong>Avatar 1</strong>
        <p style={{ margin: "4px 0 10px", fontSize: 12, color: "#64748b" }}>
          Pessoa principal, profissional ou personagem da marca.
        </p>
        <SlotCard
          dataUrl={kit.avatar}
          busy={busySlot === slotKey("avatar")}
          onPick={(f) => handleFile("avatar", f)}
          onClear={() => clearSlot("avatar")}
        />
        <VoiceBlock avatarSlot={1} />
      </div>

      <div className="formatBox">
        <strong>Avatar 2</strong>
        <p style={{ margin: "4px 0 10px", fontSize: 12, color: "#64748b" }}>
          Segundo personagem, sócio, vendedor ou perfil adicional da marca.
        </p>
        <SlotCard
          dataUrl={kit.avatar2}
          busy={busySlot === slotKey("avatar2")}
          onPick={(f) => handleFile("avatar2", f)}
          onClear={() => clearSlot("avatar2")}
        />
        <VoiceBlock avatarSlot={2} />
      </div>

      <div className="formatBox">
        <strong>Fachada</strong>
        <p style={{ margin: "4px 0 10px", fontSize: 12, color: "#64748b" }}>
          A frente do seu estabelecimento. Usada em peças que precisam mostrar o local físico da
          empresa — diferente dos cenários internos abaixo.
        </p>
        <SlotCard
          dataUrl={kit.fachada}
          busy={busySlot === slotKey("fachada")}
          onPick={(f) => handleFile("fachada", f)}
          onClear={() => clearSlot("fachada")}
        />
      </div>

      <div className="formatBox">
        <strong>Cenários</strong>
        <p style={{ margin: "4px 0 10px", fontSize: 12, color: "#64748b" }}>
          Até 2 cenários numerados (loja, escritório, ambiente interno, atmosfera). A numeração é
          fixa.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          {Array.from({ length: CENARIO_SLOTS }).map((_, i) => (
            <SlotCard
              key={i}
              label={`Cenário ${i + 1}`}
              dataUrl={kit.cenarios[i] || undefined}
              busy={busySlot === slotKey({ tipo: "cenario", index: i })}
              onPick={(f) => handleFile({ tipo: "cenario", index: i }, f)}
              onClear={() => clearSlot({ tipo: "cenario", index: i })}
              compact
            />
          ))}
        </div>
      </div>

      <div className="formatBox">
        <strong>Produtos</strong>
        <p style={{ margin: "4px 0 10px", fontSize: 12, color: "#64748b" }}>
          Até 8 produtos numerados. A numeração é fixa — apagar o Produto 3 deixa o slot 3 vazio até
          você subir outro (não reorganiza).
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {Array.from({ length: PRODUTO_SLOTS }).map((_, i) => (
            <SlotCard
              key={i}
              label={`Produto ${i + 1}`}
              dataUrl={kit.produtos[i] || undefined}
              busy={busySlot === slotKey({ tipo: "produto", index: i })}
              onPick={(f) => handleFile({ tipo: "produto", index: i }, f)}
              onClear={() => clearSlot({ tipo: "produto", index: i })}
              compact
            />
          ))}
        </div>
      </div>

      <div className="formatBox">
        <strong>Fato</strong>
        <p style={{ margin: "4px 0 10px", fontSize: 12, color: "#64748b" }}>
          Fotografia de um acontecimento (visita, confraternização, feira). Usada no Post Único com
          o objetivo "Fatos" — a foto é aplicada quase sem alteração, só com marca/título/texto
          sobrepostos.
        </p>
        <SlotCard
          dataUrl={kit.fato}
          busy={busySlot === slotKey("fato")}
          onPick={(f) => handleFile("fato", f)}
          onClear={() => clearSlot("fato")}
        />
      </div>

      <div className="formatBox">
        <strong>Venda</strong>
        <p style={{ margin: "4px 0 10px", fontSize: 12, color: "#64748b" }}>
          Foto de colaborador apresentando ou usando o produto. Usada no Post Único com o objetivo
          "Venda" — a foto é aplicada quase sem alteração, só com marca/título/texto sobrepostos
          (mesmo tratamento de "Fato").
        </p>
        <SlotCard
          dataUrl={kit.venda}
          busy={busySlot === slotKey("venda")}
          onPick={(f) => handleFile("venda", f)}
          onClear={() => clearSlot("venda")}
        />
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
        <button
          type="button"
          className="primaryBtn"
          onClick={onSave}
          disabled={saving}
          style={{ flex: 1 }}
        >
          {saving ? "Salvando..." : "Salvar Kit Imagem"}
        </button>
        {saved && <span style={{ color: "#15803d", fontWeight: 600, fontSize: 13 }}>✓ Salvo</span>}
      </div>
    </section>
  );
}

function slotKey(slot: SlotKind): string {
  if (
    slot === "avatar" ||
    slot === "avatar2" ||
    slot === "fachada" ||
    slot === "fato" ||
    slot === "venda"
  )
    return slot;
  return `${slot.tipo}-${slot.index}`;
}

interface SlotCardProps {
  label?: string;
  dataUrl?: string;
  busy?: boolean;
  compact?: boolean;
  footer?: React.ReactNode;
  onPick: (file: File) => void;
  onClear: () => void;
}

function SlotCard({ label, dataUrl, busy, compact, footer, onPick, onClear }: SlotCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const size = compact ? 130 : 180;

  return (
    <div
      style={{
        border: `1px dashed ${dataUrl ? "#cbd5e1" : "#94a3b8"}`,
        borderRadius: 12,
        background: "#f8fafc",
        padding: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {label && (
        <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", alignSelf: "flex-start" }}>
          {label}
        </span>
      )}
      <div
        style={{
          width: "100%",
          height: size,
          borderRadius: 10,
          background: "#e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {busy ? (
          <span style={{ fontSize: 12, color: "#475569" }}>Processando…</span>
        ) : dataUrl ? (
          <img
            src={dataUrl}
            alt={label || "imagem"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 12, color: "#64748b" }}>Sem imagem</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <div style={{ display: "flex", gap: 6, width: "100%" }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          style={smallBtn(true)}
        >
          {dataUrl ? "Trocar" : "Enviar"}
        </button>
        {dataUrl && (
          <button type="button" onClick={onClear} disabled={busy} style={smallBtn(false)}>
            Apagar
          </button>
        )}
      </div>
      {footer}
    </div>
  );
}

function smallBtn(primary: boolean): React.CSSProperties {
  return {
    flex: 1,
    background: primary ? "#0f172a" : "#fff",
    color: primary ? "#fff" : "#0f172a",
    border: `1px solid ${primary ? "#0f172a" : "#cbd5e1"}`,
    borderRadius: 8,
    padding: "6px 8px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}
