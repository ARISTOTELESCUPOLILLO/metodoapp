// Seção "Pré-cadastro de Cliente" da aba Convites — extraído de InvitesTab.tsx (Fase 9).
import { card, cardTitle, inp, Field } from "./primitives";
import type { Plan, TestProfile } from "./types";

export type Segment = "SERVIÇOS" | "VAREJO" | "MARCA" | "";

export function InviteForm({
  isMobile,
  plans,
  testProfiles,
  nome,
  email,
  segment,
  plano1Id,
  plano2Id,
  bonusId,
  sourceTestProfileId,
  busy,
  msg,
  onNomeChange,
  onEmailChange,
  onSegmentChange,
  onPlano1Change,
  onPlano2Change,
  onBonusChange,
  onSourceTestProfileChange,
  onSubmit,
}: {
  isMobile: boolean;
  plans: Plan[];
  testProfiles: TestProfile[];
  nome: string;
  email: string;
  segment: Segment;
  plano1Id: string;
  plano2Id: string;
  bonusId: string;
  sourceTestProfileId: string;
  busy: boolean;
  msg: string | null;
  onNomeChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onSegmentChange: (v: Segment) => void;
  onPlano1Change: (v: string) => void;
  onPlano2Change: (v: string) => void;
  onBonusChange: (v: string) => void;
  onSourceTestProfileChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const bonusPlans = plans.filter((p) => p.elegivel_bonus);
  const mainPlans = plans.filter((p) => !p.elegivel_bonus);
  const testNameFor = (id: string | null) =>
    id
      ? testProfiles.find((t) => t.id === id)?.nome ||
        testProfiles.find((t) => t.id === id)?.email ||
        "—"
      : null;

  return (
    <section style={card}>
      <h3 style={cardTitle}>＋ Pré-cadastro de Cliente</h3>
      <form
        onSubmit={onSubmit}
        style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}
      >
        <Field label="Nome">
          <input
            required
            value={nome}
            onChange={(e) => onNomeChange(e.target.value)}
            placeholder="Nome do cliente"
            style={inp}
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="email@cliente.com"
            style={inp}
          />
        </Field>
        <Field label="Segmento (obrigatório)">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {(["SERVIÇOS", "VAREJO", "MARCA"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSegmentChange(s)}
                style={{
                  padding: "8px 4px",
                  borderRadius: 6,
                  border: `2px solid ${segment === s ? "#2563eb" : "#cbd5e1"}`,
                  background: segment === s ? "#eff6ff" : "#fff",
                  color: segment === s ? "#1d4ed8" : "#0f172a",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 4, marginBottom: 0 }}>
            Fixado após o cadastro — só admin pode alterar. Define o método de geração do conteúdo.
          </p>
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
        <Field label="Migrar Kit Imagem de teste (opcional)">
          <select
            value={sourceTestProfileId}
            onChange={(e) => onSourceTestProfileChange(e.target.value)}
            style={{ ...inp, background: "#fff" }}
          >
            <option value="">— Sem migração de kit —</option>
            {testProfiles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome || t.email}
              </option>
            ))}
          </select>
        </Field>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            type="submit"
            disabled={busy}
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
              opacity: busy ? 0.6 : 1,
              width: "100%",
            }}
          >
            {busy ? "Adicionando…" : "＋ Adicionar convite"}
          </button>
        </div>
      </form>
      {sourceTestProfileId && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            background: "#fef9c3",
            border: "1px solid #fde68a",
            borderRadius: 6,
            fontSize: 12,
            color: "#713f12",
          }}
        >
          O Kit Imagem de <strong>{testNameFor(sourceTestProfileId)}</strong> será copiado para o
          novo cliente após o cadastro. O botão "Migrar Kit" aparecerá na lista abaixo assim que ele
          se cadastrar.
        </div>
      )}
      {msg && (
        <p
          style={{
            fontSize: 13,
            marginTop: 12,
            marginBottom: 0,
            color:
              msg.startsWith("Erro") ||
              msg.includes("inválid") ||
              msg.includes("já foi") ||
              msg.includes("Informe")
                ? "#b91c1c"
                : "#15803d",
          }}
        >
          {msg}
        </p>
      )}
    </section>
  );
}
