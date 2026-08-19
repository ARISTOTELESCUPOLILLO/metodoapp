// Formata o período de um plano — extraído de UsersTab.tsx (Fase 9).
//
// POR QUE DEVOLVE DUAS LINHAS (19/08/2026): a versão anterior montava uma linha
// só juntando `inicio` com `contratoFim`, e essas duas datas não são do mesmo
// período. `inicio` é o começo do MÊS CORRENTE (o cron o empurra a cada
// renovação); `contratoFim` é o fim do CONTRATO inteiro. Num cliente que já
// virou um mês, a linha encolhia sem que a duração ao lado mudasse: o Pronto Vet
// aparecia como "02/08/26 → 02/09/26 · 3 meses" — um intervalo de um mês
// rotulado como três. Os dados estavam certos; a linha é que misturava os dois.
//
// O início do CONTRATO não existe como coluna: reconstrói-se de trás para
// frente, `contratoFim - mesesContrato`, que é exatamente a conta que a trigger
// apply_slot_limits faz para gravar o fim (ver a migration
// 20260819120000_contrato-fim-independente-do-inicio.sql).

export interface PlanPeriodo {
  /** Contrato inteiro: "02/06/26 → 02/09/26 · 3 meses" */
  contrato: string;
  /** Mês corrente, quando difere do contrato: "mês 02/08 → 02/09" */
  ciclo: string;
}

const VAZIO: PlanPeriodo = { contrato: "", ciclo: "" };

function fmt(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function fmtCurto(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function somaMeses(base: Date, meses: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + meses);
  return d;
}

export function planPeriodo(
  inicio: string | null,
  tipo: string,
  mesesContrato?: number,
  contratoFim?: string | null,
  /** plano*_expira_em — fim do mês corrente. Sem ele, só o contrato aparece. */
  cicloAte?: string | null,
): PlanPeriodo {
  if (!inicio) return VAZIO;
  const start = new Date(inicio);

  if (tipo === "vitalicio") return { contrato: `${fmt(start)} · vitalício`, ciclo: "" };

  const meses = tipo === "anual" ? 12 : mesesContrato && mesesContrato > 0 ? mesesContrato : 1;
  const fim = contratoFim ? new Date(contratoFim) : somaMeses(start, meses);
  // Sem contratoFim gravado não há de onde tirar o começo do contrato — aí
  // `inicio` é a melhor aproximação que existe, e é o que a versão antiga fazia.
  const comeco = contratoFim ? somaMeses(fim, -meses) : start;
  const label = meses === 1 ? "1 mês" : `${meses} meses`;
  const contrato = `${fmt(comeco)} → ${fmt(fim)} · ${label}`;

  // O mês corrente só vira linha própria quando diz algo que o contrato não diz
  // — e o que ele diz é quando cai a próxima mensalidade. Num contrato de 1 mês
  // os dois períodos são o mesmo, e aí repetir só polui a célula.
  if (!cicloAte) return { contrato, ciclo: "" };
  const cicloFim = new Date(cicloAte);
  const mesmoPeriodo =
    Math.abs(start.getTime() - comeco.getTime()) < 86400000 &&
    Math.abs(cicloFim.getTime() - fim.getTime()) < 86400000;
  if (mesmoPeriodo) return { contrato, ciclo: "" };

  return { contrato, ciclo: `mês ${fmtCurto(start)} → ${fmtCurto(cicloFim)}` };
}
