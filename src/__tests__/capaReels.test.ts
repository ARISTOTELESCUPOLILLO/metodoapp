import { describe, it, expect } from "vitest";
import { buildImagePrompt } from "../services/api/buildImagePrompt";

// Regressão da CAPA DO REELS — achado real de 08/09/2026 (S3C, conta admin):
// o frame saiu com o avatar do Kit (homem) e a capa saiu com outra personagem
// (mulher). Causa: os call sites da capa mandavam a imagem de referência mas
// nenhum campo de personagem, e sem eles o motor sorteia o gênero em
// pickRandom(["mulher","homem"]) — sem seed — e escreve a linha "GÊNERO
// OBRIGATÓRIO (PRECEDÊNCIA MÁXIMA…)" no FIM do prompt, depois do bloco que
// manda preservar o rosto da referência.
//
// Estes testes cobrem o prompt, não a chamada HTTP: é onde a contradição
// nascia, e é verificável sem gastar geração de imagem.

const base = {
  titulo: "Sua rotina pede nova ação?",
  texto: "",
  imagePrompt: "porta-voz falando à câmera em escritório",
  primaryColor: "#0f172a",
  accentColor: "#f4b000",
  fontFamily: "Montserrat",
  moodInstructions: "",
  mood: "OP-01" as const,
  format: "reels_cover" as const,
  hasRefs: true,
  variacaoSeed: 7,
};

const LINHA_GENERO = "GÊNERO OBRIGATÓRIO";

describe("capa do Reels — âncora de personagem", () => {
  it("com referência do frame, NÃO sorteia gênero", () => {
    // hasAvatarRef=true é o que o conserto passa quando há frame de referência.
    for (let i = 0; i < 30; i++) {
      const prompt = buildImagePrompt({ ...base, hasAvatarRef: true });
      expect(prompt).not.toContain(LINHA_GENERO);
    }
  });

  it("mantém a ordem de preservar a pessoa da referência", () => {
    const prompt = buildImagePrompt({ ...base, hasAvatarRef: true });
    expect(prompt).toContain("REFERÊNCIA VISUAL OBRIGATÓRIA");
    expect(prompt).toContain("NÃO invente outra pessoa");
  });

  it("sem a âncora, o gênero era sorteado e podia contradizer o frame", () => {
    // Documenta o defeito: sem hasAvatarRef, sem forcedGender e sem
    // leituraCenica.composicao, a linha SEMPRE sai — e o gênero varia entre
    // gerações, porque o sorteio não usa a seed da sequência.
    const generos = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const prompt = buildImagePrompt({ ...base, hasAvatarRef: false });
      expect(prompt).toContain(LINHA_GENERO);
      if (prompt.includes("DEVE ser mulher")) generos.add("mulher");
      if (prompt.includes("DEVE ser homem")) generos.add("homem");
    }
    // Em 60 tentativas de uma moeda honesta, ver só um lado é praticamente
    // impossível (~1 em 5,8e17) — se falhar, o sorteio deixou de ser aleatório.
    expect(generos.size).toBe(2);
  });

  it("sem referência, forcedGender trava o personagem em vez do sorteio", () => {
    // Segunda camada do conserto: se a capa rodar sem frame de referência, o
    // gênero declarado do formulário decide — não a moeda.
    for (let i = 0; i < 30; i++) {
      const prompt = buildImagePrompt({
        ...base,
        hasRefs: false,
        hasAvatarRef: false,
        forcedGender: "homem",
      });
      expect(prompt).toContain("DEVE ser homem");
      expect(prompt).not.toContain("DEVE ser mulher");
    }
  });

  it("o título continua literal na capa (não pode ser reescrito)", () => {
    const prompt = buildImagePrompt({ ...base, hasAvatarRef: true });
    expect(prompt).toContain("TÍTULO LITERAL");
    expect(prompt).toContain(`<<<${base.titulo}>>>`);
  });
});
