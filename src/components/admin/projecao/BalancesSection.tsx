// Seção "Saldos atuais" da aba Projeção — extraído de ProjecaoTab.tsx (Fase 9).
import { usd } from "./primitives";

function BalanceCard({
  supplier,
  desc,
  balance,
  rate,
  color,
  rechargeVal,
  onRechargeChange,
  onRechargeConfirm,
  saving,
}: {
  supplier: string;
  desc: string;
  balance: number;
  rate: number;
  color: string;
  rechargeVal: string;
  onRechargeChange: (v: string) => void;
  onRechargeConfirm: () => void;
  saving: boolean;
}) {
  const val = parseFloat(rechargeVal);
  const preview = !isNaN(val) && val > 0 ? val : null;
  return (
    <div
      style={{
        border: `2px solid ${color}20`,
        borderRadius: 10,
        padding: 16,
        background: `${color}08`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {supplier}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{usd(balance)}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, marginBottom: 12 }}>
        R$ {(balance * rate).toFixed(2)} · {desc}
      </div>

      <div style={{ borderTop: `1px solid ${color}20`, paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
          Saldo atual nas APIs (USD)
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={rechargeVal}
            onChange={(e) => onRechargeChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRechargeConfirm();
            }}
            style={{
              flex: 1,
              padding: "6px 8px",
              border: `1px solid ${color}40`,
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              color,
              background: "#fff",
              outline: "none",
            }}
          />
          <button
            onClick={onRechargeConfirm}
            disabled={saving || isNaN(val) || val <= 0}
            style={{
              padding: "6px 12px",
              background: color,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              opacity: saving || isNaN(val) || val <= 0 ? 0.5 : 1,
            }}
          >
            {saving ? "…" : "Salvar"}
          </button>
        </div>
        {preview !== null && (
          <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 600 }}>
            Saldo será: {usd(preview)} · R$ {(preview * rate).toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}

export function BalancesSection({
  falaiBalance,
  openaiBalance,
  rate,
  recharge,
  onRechargeChange,
  onRechargeConfirm,
  saving,
}: {
  falaiBalance: number;
  openaiBalance: number;
  rate: number;
  recharge: { falai: string; openai: string };
  onRechargeChange: (supplier: "falai" | "openai", v: string) => void;
  onRechargeConfirm: (supplier: "falai" | "openai") => void;
  saving: "falai" | "openai" | null;
}) {
  return (
    <section>
      <h3
        style={{ fontSize: 14, fontWeight: 700, color: "var(--brand-primary)", marginBottom: 10 }}
      >
        Saldos atuais
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 12,
        }}
      >
        <BalanceCard
          supplier="fal.ai"
          desc="Imagens + Renders"
          balance={falaiBalance}
          rate={rate}
          color="#6d28d9"
          rechargeVal={recharge.falai}
          onRechargeChange={(v) => onRechargeChange("falai", v)}
          onRechargeConfirm={() => onRechargeConfirm("falai")}
          saving={saving === "falai"}
        />
        <BalanceCard
          supplier="OpenAI"
          desc="Conteúdo (texto)"
          balance={openaiBalance}
          rate={rate}
          color="#0369a1"
          rechargeVal={recharge.openai}
          onRechargeChange={(v) => onRechargeChange("openai", v)}
          onRechargeConfirm={() => onRechargeConfirm("openai")}
          saving={saving === "openai"}
        />
      </div>
      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        Informe o saldo exato que aparece no painel do fal.ai ou OpenAI. O valor digitado substitui
        o saldo atual.
      </p>
    </section>
  );
}
