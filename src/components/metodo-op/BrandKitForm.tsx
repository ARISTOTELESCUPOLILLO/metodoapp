import { BRAND_ACCENT } from "../../data/brandColors";
import { useState } from "react";
import { BrandKit, FontPair, SecondaryFont, Segment } from "../../types";
import { brandVoiceCatalog, defaultVoice } from "../../data/brandVoice";
import ConfirmDialog from "./ConfirmDialog";
import { BrandKitFormHeader } from "./brandKitForm/BrandKitFormHeader";
import { LogoSection } from "./brandKitForm/LogoSection";
import { ProductsSection, MIN_PRODUCTS } from "./brandKitForm/ProductsSection";

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
  const update = <K extends keyof BrandKit>(key: K, value: BrandKit[K]) =>
    onChange({ ...kit, [key]: value });
  const changeSegment = (segment: Segment) =>
    onChange({ ...kit, segment, brandVoice: defaultVoice(segment) });

  const products = kit.products || [];
  const productsValid = products.length >= MIN_PRODUCTS;

  return (
    <section className="panel">
      <BrandKitFormHeader
        kit={kit}
        isOpen={isOpen}
        onToggle={() => setIsOpen((o) => !o)}
        onLoad={onLoad}
        onClear={onClear}
        loading={loading}
        saving={saving}
      />

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

        <LogoSection
          kit={kit}
          update={update}
          onRemoveLogoClick={() => setConfirmRemoveLogo(true)}
          onRemoveUniformeClick={() => setConfirmRemoveUniforme(true)}
        />

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
                        border:
                          kit[key] === c
                            ? "2px solid var(--brand-accent)"
                            : "2px solid transparent",
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

        <ProductsSection
          products={products}
          segment={kit.segment}
          onProductsChange={(next) => update("products", next)}
        />

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
