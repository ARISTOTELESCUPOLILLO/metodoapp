// Helper de ciclo mensal de cobrança.
// Regra: o ciclo de um slot vence no mesmo dia do mês seguinte ao `inicio`.
// Sem bloqueio, sem reset — só sinalização visual no admin.
// Se o banco já tiver `expira_em` persistido, use computeCycleFromExpiry.

export type CycleStatus = "ok" | "due_soon" | "overdue" | "none";

export interface CycleInfo {
  dueAt: Date | null;
  daysLeft: number; // negativo = vencido
  status: CycleStatus;
}

const DUE_SOON_DAYS = 5;

function daysLeftFromDue(due: Date, now: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((startOfDue.getTime() - startOfToday.getTime()) / msPerDay);
}

function statusFromDays(daysLeft: number, dueSoonDays: number = DUE_SOON_DAYS): CycleStatus {
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= dueSoonDays) return "due_soon";
  return "ok";
}

/**
 * Usa uma data de expiração já persistida no banco (plano*_expira_em ou
 * plano*_contrato_fim). `dueSoonDays` permite um horizonte de aviso maior
 * que o padrão mensal (5d) — ex.: 30d para vencimento de contrato.
 */
export function computeCycleFromExpiry(
  expiraEm: string | null | undefined,
  now: Date = new Date(),
  dueSoonDays: number = DUE_SOON_DAYS,
): CycleInfo {
  if (!expiraEm) return { dueAt: null, daysLeft: 0, status: "none" };
  const due = new Date(expiraEm);
  if (isNaN(due.getTime())) return { dueAt: null, daysLeft: 0, status: "none" };
  const daysLeft = daysLeftFromDue(due, now);
  return { dueAt: due, daysLeft, status: statusFromDays(daysLeft, dueSoonDays) };
}

/** Calcula on-the-fly a partir de `inicio` (fallback quando expira_em não está disponível). */
export function computeCycle(inicio: string | null | undefined, now: Date = new Date()): CycleInfo {
  if (!inicio) return { dueAt: null, daysLeft: 0, status: "none" };
  const start = new Date(inicio);
  if (isNaN(start.getTime())) return { dueAt: null, daysLeft: 0, status: "none" };

  // Mesmo dia do mês seguinte (lida com 31 → último dia do mês curto).
  const due = new Date(start);
  const targetDay = start.getDate();
  due.setMonth(due.getMonth() + 1);
  if (due.getDate() !== targetDay) due.setDate(0);

  const daysLeft = daysLeftFromDue(due, now);
  return { dueAt: due, daysLeft, status: statusFromDays(daysLeft) };
}

export function cycleLabel(c: CycleInfo): string {
  if (c.status === "none" || !c.dueAt) return "";
  if (c.status === "overdue") return `vencido há ${Math.abs(c.daysLeft)}d`;
  if (c.status === "due_soon") return c.daysLeft === 0 ? "vence hoje" : `vence em ${c.daysLeft}d`;
  return `vence em ${c.daysLeft}d`;
}

export function cycleColor(c: CycleInfo): { bg: string; fg: string } | null {
  if (c.status === "overdue") return { bg: "#fee2e2", fg: "#b91c1c" };
  if (c.status === "due_soon") return { bg: "#fef3c7", fg: "#92400e" };
  return null;
}
