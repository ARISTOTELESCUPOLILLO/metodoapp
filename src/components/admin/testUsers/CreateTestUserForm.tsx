// Seção "Criar usuário de teste" — extraído de TestUsersTab.tsx (Fase 9.1).
import { card, cardTitle, inp, Field } from "./primitives";
import type { Plan, Segmento } from "./types";

export function CreateTestUserForm({
  isMobile,
  plans,
  nome,
  segmento,
  plano1Id,
  plano2Id,
  bonusId,
  busy,
  msg,
  onNomeChange,
  onSegmentoChange,
  onPlano1Change,
  onPlano2Change,
  onBonusChange,
  onSubmit,
}: {
  isMobile: boolean;
  plans: Plan[];
  nome: string;
  segmento: Segmento;
  plano1Id: string;
  plano2Id: string;
  bonusId: string;
  busy: string | null;
  msg: string | null;
  onNomeChange: (v: string) => void;
  onSegmentoChange: (v: Segmento) => void;
  onPlano1Change: (v: string) => void;
  onPlano2Change: (v: string) => void;
  onBonusChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const bonusPlans = plans.filter((p) => p.elegivel_bonus);
  const mainPlans = plans.filter((p) => !p.elegivel_bonus);

  return (
    <section style={card}>
      <h3 style={cardTitle}>＋ Criar usuário de teste</h3>
      <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px" }}>
        Cria um perfil fictício (sem e-mail real, sem login) para você atuar como ele e testar
        fluxos por segmento.
      </p>
      <form
        onSubmit={onSubmit}
        style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}
      >
        <Field label="Nome">
          <input
            required
            value={nome}
            onChange={(e) => onNomeChange(e.target.value)}
            placeholder="Ex.: Teste Varejo 1"
            style={inp}
          />
        </Field>
        <Field label="Segmento">
          <select
            value={segmento}
            onChange={(e) => onSegmentoChange(e.target.value as Segmento)}
            style={{ ...inp, background: "#fff" }}
          >
            <option value="SERVIÇOS">SERVIÇOS</option>
            <option value="VAREJO">VAREJO</option>
            <option value="MARCA">MARCA</option>
          </select>
        </Field>
        <Field label="Plano 1 (opcional)">
          <select
            value={plano1Id}
            onChange={(e) => onPlano1Change(e.target.value)}
            style={{ ...inp, background: "#fff" }}
          >
            <option value="">— Sem plano —</option>
            {mainPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {p.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plano 2 (opcional)">
          <select
            value={plano2Id}
            onChange={(e) => onPlano2Change(e.target.value)}
            style={{ ...inp, background: "#fff" }}
          >
            <option value="">— Sem plano —</option>
            {mainPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {p.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bônus (opcional)">
          <select
            value={bonusId}
            onChange={(e) => onBonusChange(e.target.value)}
            style={{ ...inp, background: "#fff" }}
          >
            <option value="">— Sem bônus —</option>
            {bonusPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {p.nome}
              </option>
            ))}
          </select>
        </Field>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            type="submit"
            disabled={busy === "new"}
            style={{
              background: "#7c3aed",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 8,
              fontWeight: 700,
              cursor: "pointer",
              opacity: busy === "new" ? 0.6 : 1,
              width: "100%",
            }}
          >
            {busy === "new" ? "Criando…" : "＋ Criar teste"}
          </button>
        </div>
      </form>
      {msg && (
        <p
          style={{
            fontSize: 13,
            marginTop: 12,
            marginBottom: 0,
            color: msg.startsWith("Erro") || msg.startsWith("Informe") ? "#b91c1c" : "#15803d",
          }}
        >
          {msg}
        </p>
      )}
    </section>
  );
}
