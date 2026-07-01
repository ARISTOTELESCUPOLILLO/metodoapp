// Formata o período de um plano (início → fim, duração) — extraído de UsersTab.tsx (Fase 9).
export function planPeriodo(
  inicio: string | null,
  tipo: string,
  mesesContrato?: number,
  contratoFim?: string | null,
): string {
  if (!inicio) return "";
  const start = new Date(inicio);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  if (tipo === "vitalicio") return `${fmt(start)} · vitalício`;
  if (tipo === "anual") {
    const end = contratoFim
      ? new Date(contratoFim)
      : (() => {
          const d = new Date(start);
          d.setFullYear(d.getFullYear() + 1);
          return d;
        })();
    return `${fmt(start)} → ${fmt(end)} · 12 meses`;
  }
  // mensal ou outros: usa mesesContrato e contratoFim
  const meses = mesesContrato && mesesContrato > 0 ? mesesContrato : 1;
  const endDate = contratoFim
    ? new Date(contratoFim)
    : (() => {
        const d = new Date(start);
        d.setMonth(d.getMonth() + meses);
        return d;
      })();
  const label = meses === 1 ? "1 mês" : `${meses} meses`;
  return `${fmt(start)} → ${fmt(endDate)} · ${label}`;
}
