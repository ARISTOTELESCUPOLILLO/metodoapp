import { buildIntencaoRegraApoio, buildIntencaoBlock } from "./src/core/intencao.ts";
import { buildRegraPolaridadeKeyInfo } from "./src/core/polaridadeKeyInfo.ts";
const base = { intencao: "confianca", transformacaoPrincipal: "preferencia", segment: "SERVIÇOS" };
console.log("=== CONTEXTO ===\n" + buildIntencaoBlock(base));
console.log("=== POLARIDADE ===\n" + buildRegraPolaridadeKeyInfo("Atendemos sem hora marcada"));
console.log("=== MANIFESTACAO ===\n" + buildIntencaoRegraApoio({ ...base, apoio: "texto" }));
