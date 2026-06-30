import { BRAND_ACCENT } from "../../data/brandColors";
import { useState } from "react";
import { BrandKit, FontPair, LogoPosition, SecondaryFont, Segment } from "../../types";
import { brandVoiceCatalog, defaultVoice } from "../../data/brandVoice";
import { fileToDataUrl } from "../../utils/file";
import ConfirmDialog from "./ConfirmDialog";

const LOGO_POSITIONS: { value: LogoPosition; label: string; hint: string }[] = [
  { value: "bottom-right", label: "Inferior direito", hint: "Padrão" },
  { value: "top-center", label: "Topo central", hint: "" },
  { value: "bottom-center", label: "Inferior central", hint: "" },
];

function LogoPositionPreview({ position, active }: { position: LogoPosition; active: boolean }) {
  const dot = {
    width: 10,
    height: 10,
    background: active ? "#0f172a" : "#475569",
    borderRadius: 2,
    position: "absolute" as const,
  };
  const style: React.CSSProperties =
    position === "top-center"
      ? { ...dot, top: 6, left: "50%", transform: "translateX(-50%)" }
      : position === "bottom-center"
        ? { ...dot, bottom: 6, left: "50%", transform: "translateX(-50%)" }
        : { ...dot, bottom: 6, right: 6 };
  return (
    <div
      style={{
        position: "relative",
        width: 44,
        height: 56,
        border: `1.5px solid ${active ? "#0f172a" : "#cbd5e1"}`,
        borderRadius: 4,
        background: "#fff",
      }}
    >
      <span style={style} />
    </div>
  );
}

interface Props {
  kit: BrandKit;
  onChange: (kit: BrandKit) => void;
  onSave?: () => void;
  onLoad?: () => void;
  onClear?: () => void;
  loading?: boolean;
  saving?: boolean;
  saved?: boolean;
  lockedSegment?: Segment;
}

const FONTS: { value: FontPair; label: string; sample: string }[] = [
  { value: "Inter", label: "Helvética", sample: "Aa" },
  { value: "Playfair Display", label: "Serifada", sample: "Aa" },
];

const SECONDARY_FONTS: {
  value: SecondaryFont;
  label: string;
  sample: string;
  cssFamily: string;
}[] = [
  { value: "fina", label: "Manuscrita fina", sample: "Aa", cssFamily: "Allura" },
  { value: "grossa", label: "Manuscrita grossa", sample: "Aa", cssFamily: "Great Vibes" },
];

const COLORS_PRESET = [
  "#123a63",
  "#0f172a",
  "#1e3a5f",
  "#1a1a2e",
  "#7c3aed",
  "#0891b2",
  "#059669",
  "#dc2626",
  "#d97706",
  BRAND_ACCENT,
  "#e5e7eb",
  "#ffffff",
];

const MIN_PRODUCTS = 3;
const MAX_PRODUCTS = 10;

export default function BrandKitForm({
  kit,
  onChange,
  onSave,
  onLoad,
  onClear,
  loading,
  saving,
  saved,
  lockedSegment,
}: Props) {
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);
  const [confirmRemoveUniforme, setConfirmRemoveUniforme] = useState(false);
  const [isOpen, setIsOpen] = useState(!kit.companyName?.trim());
  const [newProductItem, setNewProductItem] = useState("");
  const update = <K extends keyof BrandKit>(key: K, value: BrandKit[K]) =>
    onChange({ ...kit, [key]: value });
  const changeSegment = (segment: Segment) =>
    onChange({ ...kit, segment, brandVoice: defaultVoice(segment) });

  const products = kit.products || [];
  const addProductItem = () => {
    const v = newProductItem.trim();
    if (!v || products.length >= MAX_PRODUCTS) return;
    update("products", [...products, v]);
    setNewProductItem("");
  };
  const removeProductItem = (idx: number) =>
    update(
      "products",
      products.filter((_, i) => i !== idx),
    );
  const productsValid = products.length >= MIN_PRODUCTS;

  return (
    <section className="panel">
      <div
        className="sectionHeader"
        onClick={() => setIsOpen((o) => !o)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>Kit de Marca</h2>
          {!isOpen && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
                flexWrap: "wrap",
              }}
            >
              {kit.companyName && (
                <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>
                  {kit.companyName}
                </span>
              )}
              {(kit.primaryColor || kit.secondaryColor || kit.accentColor) && (
                <div style={{ display: "flex", gap: 4 }}>
                  {[kit.primaryColor, kit.secondaryColor, kit.accentColor].map((c, i) =>
                    c ? (
                      <span
                        key={i}
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: c,
                          border: "1.5px solid #e2e8f0",
                          display: "inline-block",
                        }}
                      />
                    ) : null,
                  )}
                </div>
              )}
              <span style={{ fontSize: 11, color: "#94a3b8" }}>clique para editar</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onLoad && isOpen && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLoad();
                }}
                disabled={loading || saving}
                style={{
                  background: "#f8fafc",
                  color: "#0f172a",
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "0 16px",
                  minHeight: 40,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: loading || saving ? "not-allowed" : "pointer",
                }}
                title="Carregar o Kit de Marca que você já salvou"
              >
                {loading ? "Carregando..." : "↺ Carregar meu Kit"}
              </button>
              {onClear && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  disabled={loading || saving}
                  style={{
                    background: "#f8fafc",
                    color: "#b91c1c",
                    border: "1px solid #fecaca",
                    borderRadius: 10,
                    padding: "0 16px",
                    minHeight: 40,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: loading || saving ? "not-allowed" : "pointer",
                  }}
                  title="Limpar Kit de Marca e dados locais"
                >
                  Limpar
                </button>
              )}
            </div>
          )}
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#64748b"
            strokeWidth={2.5}
            style={{
              flexShrink: 0,
              transition: "transform 0.3s ease",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      <div
        style={{
          maxHeight: isOpen ? 5000 : 0,
          overflow: "hidden",
          transition: "max-height 0.3s ease",
        }}
      >
        <div className="grid2">
          <label>
            Nome da marca
            <input
              value={kit.companyName}
              onChange={(e) => update("companyName", e.target.value)}
              placeholder="Oficina de Propaganda"
            />
          </label>
          <label>
            Segmento
            {lockedSegment ? (
              <div>
                <select
                  value={lockedSegment}
                  onChange={() => {}}
                  title="Segmento definido no perfil do usuário — não pode ser alterado aqui"
                  style={{ width: "100%" }}
                >
                  <option
                    value="SERVIÇOS"
                    disabled={lockedSegment !== "SERVIÇOS"}
                    style={{ color: lockedSegment !== "SERVIÇOS" ? "#b0b8c1" : undefined }}
                  >
                    Serviços
                  </option>
                  <option
                    value="VAREJO"
                    disabled={lockedSegment !== "VAREJO"}
                    style={{ color: lockedSegment !== "VAREJO" ? "#b0b8c1" : undefined }}
                  >
                    Varejo
                  </option>
                  <option
                    value="MARCA"
                    disabled={lockedSegment !== "MARCA"}
                    style={{ color: lockedSegment !== "MARCA" ? "#b0b8c1" : undefined }}
                  >
                    Marca
                  </option>
                </select>
                <span style={{ fontSize: 11, color: "#64748b", marginTop: 3, display: "block" }}>
                  Definido no perfil — altere na aba de usuário
                </span>
              </div>
            ) : (
              <select
                value={kit.segment}
                onChange={(e) => changeSegment(e.target.value as Segment)}
              >
                <option value="SERVIÇOS">Serviços</option>
                <option value="VAREJO">Varejo</option>
                <option value="MARCA">Marca</option>
              </select>
            )}
          </label>
        </div>

        <div className="grid2">
          <label>
            Logotipo
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) update("logoDataUrl", await fileToDataUrl(file));
              }}
            />
            {kit.logoDataUrl && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <img
                  src={kit.logoDataUrl}
                  alt="logo"
                  style={{
                    height: 40,
                    objectFit: "contain",
                    borderRadius: 8,
                    background: "#f1f5f9",
                    padding: 4,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setConfirmRemoveLogo(true)}
                  style={{
                    background: "#fff",
                    color: "#b91c1c",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title="Remover a logomarca atual"
                >
                  🗑 Remover logomarca
                </button>
              </div>
            )}
          </label>

          <div>
            <strong style={{ display: "block", fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
              Posição da logomarca na peça
            </strong>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {LOGO_POSITIONS.map((p) => {
                const active = (kit.logoPosition || "bottom-right") === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => update("logoPosition", p.value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      border: `2px solid ${active ? "#0f172a" : "#cbd5e1"}`,
                      borderRadius: 10,
                      background: active ? "#f1f5f9" : "#fff",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                    title={`${p.label}${p.hint ? " — " + p.hint : ""}`}
                  >
                    <LogoPositionPreview position={p.value} active={active} />
                    <span
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        lineHeight: 1.2,
                      }}
                    >
                      {p.label}
                      {p.hint && (
                        <small style={{ color: "#64748b", fontWeight: 500 }}>{p.hint}</small>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="checkRow" style={{ alignSelf: "end", marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={kit.logoHasName}
              onChange={(e) => update("logoHasName", e.target.checked)}
            />
            Logotipo já contém o nome da marca
          </label>
        </div>

        <div className="grid2">
          <label>
            Uniforme da empresa (opcional)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) update("uniformeDataUrl", await fileToDataUrl(file));
              }}
            />
            <small style={{ color: "#64748b", fontWeight: 500, display: "block", marginTop: 4 }}>
              Foto da camisa/uniforme, sem rosto — usamos só a cor, o modelo e a posição da logo.
              Habilita a opção "Gerar com uniforme" nas peças.
            </small>
            {kit.uniformeDataUrl && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <img
                  src={kit.uniformeDataUrl}
                  alt="uniforme"
                  style={{
                    height: 64,
                    objectFit: "contain",
                    borderRadius: 8,
                    background: "#f1f5f9",
                    padding: 4,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setConfirmRemoveUniforme(true)}
                  style={{
                    background: "#fff",
                    color: "#b91c1c",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title="Remover a foto do uniforme atual"
                >
                  🗑 Remover uniforme
                </button>
              </div>
            )}
          </label>
        </div>

        <div className="colorSection">
          <strong className="colorLabel">Cores da marca</strong>
          <div className="colorGrid">
            {(["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => (
              <div key={key} className="colorItem">
                <span className="colorName">
                  {key === "primaryColor"
                    ? "Primária"
                    : key === "secondaryColor"
                      ? "Secundária"
                      : "Destaque"}
                </span>
                <div className="colorRow">
                  <input
                    type="color"
                    value={kit[key] || BRAND_ACCENT}
                    onChange={(e) => update(key, e.target.value)}
                    className="colorPicker"
                  />
                  <input
                    type="text"
                    value={kit[key] || BRAND_ACCENT}
                    onChange={(e) => update(key, e.target.value)}
                    className="colorHex"
                    placeholder="#000000"
                  />
                </div>
                <div className="colorPresets">
                  {COLORS_PRESET.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="colorDot"
                      style={{
                        background: c,
                        border: kit[key] === c ? "2px solid var(--brand-accent)" : "2px solid transparent",
                      }}
                      onClick={() => update(key, c)}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="fontSection">
          <strong className="fontLabel">Tipografia</strong>
          <div className="fontGrid">
            {FONTS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`fontCard${kit.fontPair === f.value ? " active" : ""}`}
                onClick={() => update("fontPair", f.value)}
                style={{ fontFamily: f.value }}
              >
                <span className="fontSample">{f.sample}</span>
                <span className="fontName">{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="fontSection">
          <strong className="fontLabel">
            Manuscrita{" "}
            <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>(opcional)</span>
          </strong>
          <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 8px" }}>
            Destaca 1 palavra do título numa fonte manuscrita, na cor de destaque.
          </p>
          <div className="fontGrid">
            {SECONDARY_FONTS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`fontCard${kit.secondaryFont === f.value ? " active" : ""}`}
                onClick={() =>
                  update("secondaryFont", kit.secondaryFont === f.value ? undefined : f.value)
                }
                style={{ fontFamily: f.cssFamily }}
              >
                <span className="fontSample">{f.sample}</span>
                <span className="fontName">{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        <label>
          Tom de voz
          <select value={kit.brandVoice} onChange={(e) => update("brandVoice", e.target.value)}>
            {brandVoiceCatalog[kit.segment].map((voice) => (
              <option key={voice} value={voice}>
                {voice}
              </option>
            ))}
          </select>
        </label>

        {kit.segment === "MARCA" && (
          <label className="checkRow">
            <input
              type="checkbox"
              checked={!!kit.isPersonalBrand}
              onChange={(e) => update("isPersonalBrand", e.target.checked)}
            />
            Esta marca é pessoal (o dono/profissional é a própria marca)
          </label>
        )}

        <label>
          Atividade principal
          <input
            value={kit.mainActivity || ""}
            onChange={(e) => update("mainActivity", e.target.value)}
            placeholder="Ex.: consultoria de marketing digital para pequenos negócios"
          />
        </label>

        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
              Produtos, serviços ou especialidades <span style={{ color: "#dc2626" }}>*</span>
            </span>
            <span style={{ fontSize: 11, color: productsValid ? "#94a3b8" : "#dc2626" }}>
              {products.length}/{MAX_PRODUCTS} · mínimo {MIN_PRODUCTS}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
            Liste o que {kit.segment === "MARCA" ? "a marca" : "a empresa"} vende, faz ou oferece. A
            IA usa pra sugerir assuntos de post.
          </p>
          {products.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {products.map((item, i) => (
                <span
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: 999,
                    padding: "4px 6px 4px 12px",
                    fontSize: 13,
                    color: "#0f172a",
                  }}
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removeProductItem(i)}
                    aria-label={`Remover ${item}`}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#94a3b8",
                      fontSize: 15,
                      lineHeight: 1,
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {products.length < MAX_PRODUCTS && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="text"
                value={newProductItem}
                onChange={(e) => setNewProductItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addProductItem();
                  }
                }}
                placeholder="Ex.: Troca de óleo e filtros"
                style={{ flex: "1 1 160px", minWidth: 0 }}
              />
              <button
                type="button"
                onClick={addProductItem}
                disabled={!newProductItem.trim()}
                style={{
                  background: "#0f172a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "0 16px",
                  minHeight: 40,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: newProductItem.trim() ? "pointer" : "not-allowed",
                  opacity: newProductItem.trim() ? 1 : 0.5,
                  flexShrink: 0,
                }}
              >
                + Adicionar
              </button>
            </div>
          )}
          {!productsValid && (
            <span style={{ fontSize: 12, color: "#dc2626" }}>
              Adicione pelo menos {MIN_PRODUCTS - products.length} item
              {MIN_PRODUCTS - products.length === 1 ? "" : "s"} para salvar o Kit.
            </span>
          )}
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
              Assinatura{" "}
              <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>
                (opcional · até 100 caracteres)
              </span>
            </span>
            <span
              style={{
                fontSize: 11,
                color: (kit.assinatura || "").length > 90 ? "#ef4444" : "#94a3b8",
              }}
            >
              {(kit.assinatura || "").length}/100
            </span>
          </div>
          <input
            type="text"
            maxLength={100}
            value={kit.assinatura || ""}
            onChange={(e) => update("assinatura", e.target.value)}
            placeholder="Ex.: 📞 (11) 99999-9999 · www.suamarca.com.br"
          />
        </div>

        {onSave && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button
              type="button"
              className="saveBtn"
              onClick={onSave}
              disabled={saving || loading || !productsValid}
              title={
                !productsValid
                  ? `Adicione pelo menos ${MIN_PRODUCTS} produtos/serviços para salvar`
                  : undefined
              }
            >
              {saving ? "Salvando..." : saved ? "✓ Kit salvo" : "💾 Salvar Kit"}
            </button>
          </div>
        )}
      </div>
      {/* /collapsible */}

      <ConfirmDialog
        open={confirmRemoveLogo}
        tone="danger"
        title="Remover logomarca?"
        message="A logomarca atual será removida do formulário. Você precisará subir uma nova imagem antes de clicar em Salvar Kit para confirmar a alteração."
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        onConfirm={() => {
          update("logoDataUrl", undefined);
          setConfirmRemoveLogo(false);
        }}
        onCancel={() => setConfirmRemoveLogo(false)}
      />

      <ConfirmDialog
        open={confirmRemoveUniforme}
        tone="danger"
        title="Remover uniforme?"
        message="A foto do uniforme atual será removida do formulário. A opção 'Gerar com uniforme' deixará de aparecer até subir uma nova foto e clicar em Salvar Kit."
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        onConfirm={() => {
          update("uniformeDataUrl", undefined);
          setConfirmRemoveUniforme(false);
        }}
        onCancel={() => setConfirmRemoveUniforme(false)}
      />
    </section>
  );
}
