import { describe, it, expect } from "vitest";
import { planPeriodo } from "../components/admin/users/planPeriodo";

// Casos REAIS de 19/08/2026 (aba Clientes > Usuários). O defeito: a célula
// juntava o início do MÊS CORRENTE com o fim do CONTRATO e escrevia a duração
// do contrato ao lado — num cliente que já tinha virado um mês, o intervalo
// exibido encolhia sem o rótulo mudar.

const MENSAL = "mensal";

describe("planPeriodo — contrato e mês corrente não se misturam", () => {
  // Pronto Vet, S3V: contrato de 02/06 a 02/09 (3 meses), rodando o 3º mês.
  // Antes: "02/08/26 → 02/09/26 · 3 meses" (um mês rotulado como três).
  it("mostra o contrato inteiro mesmo quando o cliente já virou dois meses", () => {
    const p = planPeriodo(
      "2026-08-02T18:44:00+00:00",
      MENSAL,
      3,
      "2026-09-02T12:00:00+00:00",
      "2026-09-02T18:44:00+00:00",
    );
    expect(p.contrato).toBe("02/06/26 → 02/09/26 · 3 meses");
    expect(p.ciclo).toBe("mês 02/08 → 02/09");
  });

  // Moto Vale, PU8 depois do acerto: primeiro mês do contrato. Aqui o começo
  // coincide, mas o ciclo ainda diz o que o contrato não diz — quando cai a
  // próxima mensalidade.
  it("no primeiro mês o ciclo aparece, porque a mensalidade vence antes do contrato", () => {
    const p = planPeriodo(
      "2026-07-19T12:00:00+00:00",
      MENSAL,
      3,
      "2026-10-19T12:00:00+00:00",
      "2026-08-19T12:00:00+00:00",
    );
    expect(p.contrato).toBe("19/07/26 → 19/10/26 · 3 meses");
    expect(p.ciclo).toBe("mês 19/07 → 19/08");
  });

  it("contrato de um mês só: começo e fim coincidem com o ciclo, sem segunda linha", () => {
    const p = planPeriodo(
      "2026-08-05T12:00:00+00:00",
      MENSAL,
      1,
      "2026-09-05T12:00:00+00:00",
      "2026-09-05T12:00:00+00:00",
    );
    expect(p.contrato).toBe("05/08/26 → 05/09/26 · 1 mês");
    expect(p.ciclo).toBe("");
  });

  it("sem o fim do ciclo (chamada antiga) devolve só o contrato", () => {
    const p = planPeriodo("2026-08-02T12:00:00+00:00", MENSAL, 3, "2026-09-02T12:00:00+00:00");
    expect(p.contrato).toBe("02/06/26 → 02/09/26 · 3 meses");
    expect(p.ciclo).toBe("");
  });

  // Sem contrato_fim gravado não há de onde tirar o começo do contrato — o
  // comportamento antigo (inicio + meses) continua valendo.
  it("sem contrato_fim, projeta a partir do início", () => {
    const p = planPeriodo("2026-08-02T12:00:00+00:00", MENSAL, 3, null, null);
    expect(p.contrato).toBe("02/08/26 → 02/11/26 · 3 meses");
  });

  it("vitalício e anual continuam como eram", () => {
    expect(planPeriodo("2026-06-02T12:00:00+00:00", "vitalicio").contrato).toBe(
      "02/06/26 · vitalício",
    );
    const anual = planPeriodo(
      "2026-08-02T12:00:00+00:00",
      "anual",
      undefined,
      "2027-06-02T12:00:00+00:00",
      "2026-09-02T12:00:00+00:00",
    );
    expect(anual.contrato).toBe("02/06/26 → 02/06/27 · 12 meses");
    expect(anual.ciclo).toBe("mês 02/08 → 02/09");
  });

  it("sem início não há o que mostrar", () => {
    expect(planPeriodo(null, MENSAL, 3, "2026-09-02T12:00:00+00:00")).toEqual({
      contrato: "",
      ciclo: "",
    });
  });
});
