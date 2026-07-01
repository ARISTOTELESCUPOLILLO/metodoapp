import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { loadVisaoGeralData } from "@/lib/visaoGeral.functions";
import { computeVisaoGeralView } from "./visaoGeral/computeVisaoGeralView";
import { SectionTitle, BigCard, R, U } from "./visaoGeral/primitives";
import { ApiCard } from "./visaoGeral/ApiCard";
import type { Plan, Profile, Settings } from "./visaoGeral/types";

export function VisaoGeralTab() {
  const loadVisaoGeralDataFn = useServerFn(loadVisaoGeralData);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadVisaoGeralDataFn({ data: undefined });
    setProfiles(data.profiles);
    setPlans(data.plans);
    setAdminIds(new Set(data.adminIds));
    setSettings(data.settings);
    setLoading(false);
  }, [loadVisaoGeralDataFn]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p style={{ color: "#64748b", padding: 12 }}>Carregando painel…</p>;

  const view = computeVisaoGeralView(profiles, plans, adminIds, settings);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* ── Bloco 1: Usuários ─────────────────────────── */}
      <section>
        <SectionTitle>Usuários</SectionTitle>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <BigCard
            label="Clientes reais"
            value={String(view.clients.length)}
            sub={`${view.activeClients} ativo${view.activeClients !== 1 ? "s" : ""} · ${view.clients.length - view.activeClients} inativo${view.clients.length - view.activeClients !== 1 ? "s" : ""}`}
            color="var(--brand-primary)"
          />
          <BigCard label="Usuários teste" value={String(view.tests.length)} color="#92400e" />
          <BigCard label="Admins" value={String(view.admins.length)} color="#4c1d95" />
        </div>
      </section>

      {/* ── Bloco 2: Financeiro ───────────────────────── */}
      <section>
        <SectionTitle>Financeiro — clientes reais</SectionTitle>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <BigCard label="Total vendido" value={R(view.totalSold)} color="#15803d" />
          <BigCard label="Custo proj." value={R(view.totalCostBrl)} color="#b45309" />
          <BigCard
            label="Lucro estimado"
            value={R(view.lucro)}
            color={view.lucro >= 0 ? "#15803d" : "#dc2626"}
          />
          <BigCard
            label="Margem"
            value={view.margin !== null ? `${view.margin.toFixed(0)}%` : "—"}
            color={view.margin !== null && view.margin >= 0 ? "#15803d" : "#dc2626"}
          />
        </div>
        {view.totalSold === 0 && (
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
            Nenhum preço preenchido ainda. Preencha o campo "R$" em cada plano do cliente (aba
            Clientes).
          </p>
        )}
      </section>

      {/* ── Bloco 3: Saldo das APIs ───────────────────── */}
      <section>
        <SectionTitle>Saldo das APIs</SectionTitle>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <ApiCard
            name="fal.ai (imagens e vídeos)"
            balance={U(view.falB)}
            custo={view.falaiCost > 0 ? `${U(view.falaiCost)} / ciclo` : "Sem planos ativos"}
            cycles={view.falaiCycles}
            barPct={view.falaiBarPct}
          />

          <ApiCard
            name="OpenAI (conteúdo)"
            balance={U(view.oaiB)}
            custo={view.openaiCost > 0 ? `${U(view.openaiCost)} / ciclo` : "Sem planos ativos"}
            cycles={view.openaiCycles}
            barPct={view.openaiBarPct}
          />
        </div>
      </section>

      {/* ── Rodapé ────────────────────────────────────── */}
      <p style={{ fontSize: 11, color: "#94a3b8", borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
        Custo proj. = 100% dos limites contratados × preço unitário × câmbio. Para consumo real,
        veja "Custos e Consumo". Cobertura = saldo da API ÷ custo projetado por ciclo dos clientes
        reais.
      </p>
    </div>
  );
}
