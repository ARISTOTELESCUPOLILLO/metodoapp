import { describe, it, expect } from "vitest";
import {
  policyPorFormato,
  totalImagens,
  descrevePolicy,
  ordemGruposPorSegmento,
  NO_POLICY,
  PU_MAX_PRODUTOS,
} from "../core/referenciasPolicy";

// ── policyPorFormato ──────────────────────────────────────────────────────────
// Esta função é a fonte única de verdade das regras de referência visual.
// Bugs causados por violação dessas regras foram recorrentes no histórico
// (produtos aparecendo em MOP MARCA/SERVIÇOS estático — commit f447855, cb6fa4c).

describe("policyPorFormato — MOP estático", () => {
  it("VAREJO: permite até 3 produtos", () => {
    expect(policyPorFormato("VAREJO", "estatico", null)).toEqual({
      avatar: true,
      fachada: true,
      cenarios: 1,
      produtos: 3,
    });
  });

  it("SERVIÇOS: proíbe produtos", () => {
    expect(policyPorFormato("SERVIÇOS", "estatico", null)).toEqual({
      avatar: true,
      fachada: true,
      cenarios: 1,
      produtos: 0,
    });
  });

  it("MARCA: proíbe produtos", () => {
    expect(policyPorFormato("MARCA", "estatico", null)).toEqual({
      avatar: true,
      fachada: true,
      cenarios: 1,
      produtos: 0,
    });
  });
});

describe("policyPorFormato — MOP estático_final", () => {
  it("VAREJO: permite até 3 produtos", () => {
    expect(policyPorFormato("VAREJO", "estatico_final", null)).toEqual({
      avatar: true,
      fachada: true,
      cenarios: 1,
      produtos: 3,
    });
  });

  it("SERVIÇOS: proíbe produtos", () => {
    expect(policyPorFormato("SERVIÇOS", "estatico_final", null)).toEqual({
      avatar: true,
      fachada: true,
      cenarios: 1,
      produtos: 0,
    });
  });

  it("MARCA: proíbe produtos", () => {
    expect(policyPorFormato("MARCA", "estatico_final", null)).toEqual({
      avatar: true,
      fachada: true,
      cenarios: 1,
      produtos: 0,
    });
  });
});

describe("policyPorFormato — MOP carrossel (todos os segmentos aceitam produtos)", () => {
  it("VAREJO: sem avatar, até 5 produtos", () => {
    expect(policyPorFormato("VAREJO", "carrossel", null)).toEqual({
      avatar: false,
      fachada: true,
      cenarios: 1,
      produtos: 5,
    });
  });

  it("SERVIÇOS: sem avatar, até 5 produtos", () => {
    expect(policyPorFormato("SERVIÇOS", "carrossel", null)).toEqual({
      avatar: false,
      fachada: true,
      cenarios: 1,
      produtos: 5,
    });
  });

  it("MARCA: sem avatar, até 5 produtos", () => {
    expect(policyPorFormato("MARCA", "carrossel", null)).toEqual({
      avatar: false,
      fachada: true,
      cenarios: 1,
      produtos: 5,
    });
  });
});

describe("policyPorFormato — MOP reels (sem produto em nenhum segmento)", () => {
  it("VAREJO reels: sem produto", () => {
    const p = policyPorFormato("VAREJO", "reels", null);
    expect(p.produtos).toBe(0);
    expect(p.avatar).toBe(true);
    expect(p.cenarios).toBe(2);
  });

  it("SERVIÇOS reels: sem produto", () => {
    expect(policyPorFormato("SERVIÇOS", "reels", null).produtos).toBe(0);
  });

  it("MARCA reels: sem produto", () => {
    expect(policyPorFormato("MARCA", "reels", null).produtos).toBe(0);
  });
});

describe("policyPorFormato — modelo EXP (generoso em todos os formatos)", () => {
  it("EXP ignora segmento e formato: 2 cenários, 5 produtos, avatar", () => {
    const expected = { avatar: true, fachada: true, cenarios: 2, produtos: 5 };
    expect(policyPorFormato("VAREJO", "estatico", "EXP")).toEqual(expected);
    expect(policyPorFormato("SERVIÇOS", "carrossel", "EXP")).toEqual(expected);
    expect(policyPorFormato("MARCA", "reels", "EXP")).toEqual(expected);
  });
});

describe("policyPorFormato — modelo PU (usa PU_MAX_PRODUTOS)", () => {
  it("PU2: 2 cenários, PU_MAX_PRODUTOS produtos, avatar", () => {
    const p = policyPorFormato("VAREJO", "estatico", "PU2");
    expect(p).toEqual({ avatar: true, fachada: true, cenarios: 2, produtos: PU_MAX_PRODUTOS });
  });

  it("PU4 e PU8 têm a mesma policy que PU2", () => {
    const pu2 = policyPorFormato("SERVIÇOS", "carrossel", "PU2");
    expect(policyPorFormato("SERVIÇOS", "carrossel", "PU4")).toEqual(pu2);
    expect(policyPorFormato("SERVIÇOS", "carrossel", "PU8")).toEqual(pu2);
  });
});

// ── totalImagens ──────────────────────────────────────────────────────────────
describe("totalImagens", () => {
  it("NO_POLICY → 0 imagens", () => {
    expect(totalImagens(NO_POLICY)).toBe(0);
  });

  it("VAREJO estatico: avatar + fachada + 1 cenário + 3 produtos = 6", () => {
    const p = policyPorFormato("VAREJO", "estatico", null);
    expect(totalImagens(p)).toBe(6); // 1+1+1+3
  });

  it("carrossel: fachada + 1 cenário + 5 produtos = 7 (sem avatar)", () => {
    const p = policyPorFormato("VAREJO", "carrossel", null);
    expect(totalImagens(p)).toBe(7); // 0+1+1+5
  });

  it("SERVIÇOS estatico: avatar + fachada + 1 cenário = 3 (sem produto)", () => {
    const p = policyPorFormato("SERVIÇOS", "estatico", null);
    expect(totalImagens(p)).toBe(3); // 1+1+1+0
  });
});

// ── descrevePolicy ────────────────────────────────────────────────────────────
describe("descrevePolicy", () => {
  it("NO_POLICY → 'nenhuma imagem permitida'", () => {
    expect(descrevePolicy(NO_POLICY)).toBe("nenhuma imagem permitida");
  });

  it("VAREJO estatico descreve produtos corretamente", () => {
    const desc = descrevePolicy(policyPorFormato("VAREJO", "estatico", null));
    expect(desc).toContain("1 avatar");
    expect(desc).toContain("fachada");
    expect(desc).toContain("até 3 produtos");
  });

  it("SERVIÇOS estatico não menciona produtos", () => {
    const desc = descrevePolicy(policyPorFormato("SERVIÇOS", "estatico", null));
    expect(desc).not.toContain("produto");
  });

  it("carrossel menciona cenário e produtos, não avatar", () => {
    const desc = descrevePolicy(policyPorFormato("VAREJO", "carrossel", null));
    expect(desc).not.toContain("avatar");
    expect(desc).toContain("até 5 produtos");
  });
});

// ── ordemGruposPorSegmento ────────────────────────────────────────────────────
describe("ordemGruposPorSegmento", () => {
  it("VAREJO: produto vem primeiro", () => {
    expect(ordemGruposPorSegmento("VAREJO")[0]).toBe("produto");
  });

  it("SERVIÇOS: avatar vem primeiro", () => {
    expect(ordemGruposPorSegmento("SERVIÇOS")[0]).toBe("avatar");
  });

  it("MARCA: cenario vem primeiro", () => {
    expect(ordemGruposPorSegmento("MARCA")[0]).toBe("cenario");
  });
});
