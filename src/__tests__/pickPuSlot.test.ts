// Escolha do slot que o Post Único usa.
//
// Achado real 06/08/2026 (Ari, conta Atrevidinha): plano1 = PU4 com as 6
// imagens gastas, bônus = PU2 recém-atribuído com 3 imagens livres. A escolha
// antiga pegava o primeiro slot PU da lista — o PU4 esgotado — e o Post Único
// ficava travado: puImgsRestantes = 0 fazia o PostUnicoForm calcular
// `semImagens` e desabilitar o botão "Gerar título e texto", com o bônus
// intacto ao lado. O bônus só era considerado quando NÃO havia nenhum outro
// plano PU, ou seja, nunca no caso em que ele existe para socorrer.

import { describe, it, expect } from "vitest";
import { pickPuSlot } from "../hooks/usePlanSlots";
import type { SlotInfo } from "../repository/profile.repo";

const FUTURO = "2030-01-01T00:00:00Z";
const PASSADO = "2020-01-01T00:00:00Z";

function slot(
  key: SlotInfo["key"],
  codigo: string,
  imgsUsadas: number,
  imgsLimite: number,
  expiraEm: string | null = FUTURO,
): SlotInfo {
  return {
    key,
    label: codigo,
    plan: { codigo } as SlotInfo["plan"],
    inicio: null,
    expiraEm,
    imgsUsadas,
    imgsLimite,
    imgsLimiteDisplay: imgsLimite,
    rendersUsados: 0,
    rendersLimite: 0,
    rendersLimiteDisplay: 0,
    geracoesUsadas: 0,
    geracoesLimite: 0,
    geracoesLimiteDisplay: 0,
  };
}

describe("pickPuSlot", () => {
  it("caso Atrevidinha: PU4 esgotado + bônus PU2 livre → usa o bônus", () => {
    const slots = [slot("plano1", "PU4", 6, 6), slot("bonus", "PU2", 0, 3)];
    expect(pickPuSlot(slots)?.key).toBe("bonus");
  });

  it("com o plano principal ainda tendo saldo, o bônus não é tocado", () => {
    const slots = [slot("plano1", "PU4", 2, 6), slot("bonus", "PU2", 0, 3)];
    expect(pickPuSlot(slots)?.key).toBe("plano1");
  });

  it("todos esgotados → devolve o primeiro, para a UI mostrar o esgotamento", () => {
    const slots = [slot("plano1", "PU4", 6, 6), slot("bonus", "PU2", 3, 3)];
    expect(pickPuSlot(slots)?.key).toBe("plano1");
  });

  it("ignora slot expirado mesmo com imagem sobrando", () => {
    const slots = [slot("plano1", "PU4", 0, 6, PASSADO), slot("bonus", "PU2", 0, 3)];
    expect(pickPuSlot(slots)?.key).toBe("bonus");
  });

  it("limite 0 é ilimitado, não esgotado (mesma convenção do backend)", () => {
    const slots = [slot("plano1", "PU4", 99, 0), slot("bonus", "PU2", 0, 3)];
    expect(pickPuSlot(slots)?.key).toBe("plano1");
  });

  it("ignora planos que não são de Post Único", () => {
    const slots = [slot("plano1", "S3V", 0, 30), slot("bonus", "PU2", 0, 3)];
    expect(pickPuSlot(slots)?.key).toBe("bonus");
  });

  it("sem nenhum plano PU, não devolve slot", () => {
    expect(pickPuSlot([slot("plano1", "S3V", 0, 30)])).toBeUndefined();
    expect(pickPuSlot([])).toBeUndefined();
  });

  it("dois planos PU pagos: cai no segundo quando o primeiro esgota", () => {
    const slots = [slot("plano1", "PU4", 6, 6), slot("plano2", "PU8", 1, 12)];
    expect(pickPuSlot(slots)?.key).toBe("plano2");
  });
});
