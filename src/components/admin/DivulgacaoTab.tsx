import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import heroDesktopUrl from "@/assets/lp-hero-desktop.png";
import { loadDivulgacaoPlans } from "@/lib/divulgacao.functions";
import { generateCard } from "./divulgacao/canvasCard";
import { PlanCardPreview } from "./divulgacao/PlanCardPreview";
import type { Plan } from "./divulgacao/types";

export function DivulgacaoTab() {
  const loadDivulgacaoPlansFn = useServerFn(loadDivulgacaoPlans);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadDivulgacaoPlansFn({ data: undefined }).then((res) => {
      setPlans(res.plans);
      setLoading(false);
    });
  }, [loadDivulgacaoPlansFn]);

  async function handleDownload(plan: Plan) {
    setDownloading(plan.id);
    try {
      await generateCard(plan, heroDesktopUrl);
    } catch (e) {
      console.error("card error", e);
    }
    setDownloading(null);
  }

  async function handleDownloadAll() {
    for (const plan of plans.filter((p) => p.ativo)) {
      setDownloading(plan.id);
      try {
        await generateCard(plan, heroDesktopUrl);
        await new Promise((r) => setTimeout(r, 400));
      } catch (e) {
        console.error("card error", e);
      }
    }
    setDownloading(null);
  }

  if (loading) return <p style={{ color: "#64748b" }}>Carregando…</p>;

  const active = plans.filter((p) => p.ativo);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Cards de Divulgação</h2>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 0 }}>
            Cards 1080×1080 px para cada plano ativo. Defina o <strong>Preço máx</strong> em{" "}
            <em>Tabela de Preços</em> antes de baixar.
          </p>
        </div>
        <button
          onClick={handleDownloadAll}
          disabled={downloading !== null}
          style={{
            background: "var(--brand-primary)",
            color: "#fff",
            border: "none",
            padding: "8px 16px",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            whiteSpace: "nowrap",
            opacity: downloading !== null ? 0.6 : 1,
          }}
        >
          ↓ Baixar todos ({active.length})
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {active.map((plan) => (
          <PlanCardPreview
            key={plan.id}
            plan={plan}
            downloading={downloading}
            onDownload={handleDownload}
          />
        ))}
      </div>

      <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
        Canvas 1080×1080 px · imagem da capa desktop no topo · fonte Inter. Defina os preços em{" "}
        <em>Tabela de Preços</em> e baixe novamente.
      </p>
    </div>
  );
}
