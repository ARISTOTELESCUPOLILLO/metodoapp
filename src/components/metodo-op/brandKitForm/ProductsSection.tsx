// Seção "Produtos, serviços ou especialidades" do Kit de Marca — extraído
// de BrandKitForm.tsx (PLANO_V2 Fase 9.1). JSX e lógica movidos 1:1, sem
// mudança de comportamento.
import { useState } from "react";
import type { Segment } from "../../../types";
import { correctPortuguese } from "../../../services/textCorrection";
import { tokensDeConteudo } from "../../../core/sugestaoValidation";

export const MIN_PRODUCTS = 3;
const MAX_PRODUCTS = 10;

// Acima disto o nome não cabe no título de uma peça (6 palavras no total, e o
// título ainda precisa DIZER alguma coisa além de nomear o produto).
//
// Conta TOKENS DE CONTEÚDO, não palavras: "Ração para cão adulto" tem 4
// palavras mas 3 ideias, e é um nome bom. Levantamento dos 97 produtos reais
// cadastrados (09/09/2026): 27% passam de 3 palavras, mas quase todos cabem em
// 3 tokens — os que estouram são os de fato longos ("Bomba de transferência do
// óleo do câmbio", "Ebook 6 Estilos Artísticos para Criar Conteúdo").
//
// É AVISO, nunca bloqueio: cortar no cadastro invalidaria um quarto do que já
// existe, e os nomes de 4-5 palavras do banco são majoritariamente PARES que só
// se distinguem pelo qualificador ("Ração para cão adulto" × "Ração para gato
// filhote") — encurtar à força aproximaria justamente o que precisa ficar
// separado.
const MAX_TOKENS_CONFORTAVEL = 3;

interface Props {
  products: string[];
  segment: Segment;
  onProductsChange: (next: string[]) => void;
}

export function ProductsSection({ products, segment, onProductsChange }: Props) {
  const [newProductItem, setNewProductItem] = useState("");
  const [checking, setChecking] = useState(false);
  // Correção gramatical é opt-in: o corretor genérico pode marcar nome de marca
  // ou termo técnico como "erro", então mostramos a sugestão e só aplicamos se o
  // usuário confirmar — nunca autocorrigimos em silêncio.
  const [suggestion, setSuggestion] = useState<{ original: string; corrected: string } | null>(
    null,
  );

  const commitProductItem = (text: string) => {
    if (!text || products.length >= MAX_PRODUCTS) return;
    onProductsChange([...products, text]);
    setNewProductItem("");
    setSuggestion(null);
  };

  const addProductItem = async () => {
    const v = newProductItem.trim();
    if (!v || products.length >= MAX_PRODUCTS || checking) return;
    setChecking(true);
    try {
      const corrected = (await correctPortuguese(v)).trim();
      if (corrected && corrected !== v) {
        setSuggestion({ original: v, corrected });
      } else {
        commitProductItem(v);
      }
    } catch {
      // Fail-open: falha do corretor (rede, rate limit, saldo) nunca bloqueia o
      // cadastro — adiciona o item como digitado.
      commitProductItem(v);
    } finally {
      setChecking(false);
    }
  };

  const removeProductItem = (idx: number) => onProductsChange(products.filter((_, i) => i !== idx));
  const productsValid = products.length >= MIN_PRODUCTS;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
          Produtos, serviços ou especialidades <span style={{ color: "#dc2626" }}>*</span>
        </span>
        <span style={{ fontSize: 11, color: productsValid ? "#94a3b8" : "#dc2626" }}>
          {products.length}/{MAX_PRODUCTS} · mínimo {MIN_PRODUCTS}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
        Liste o que {segment === "MARCA" ? "a marca" : "a empresa"} vende, faz ou oferece — um item
        por produto/serviço. Quanto mais específico, melhor a Sugestão: prefira "Ração para
        filhotes" e "Ração para cães adultos" em vez de só "Ração para cães e gatos".
      </p>
      {products.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {products.map((item, i) => (
            <span
              key={i}
              title={
                tokensDeConteudo(item).length > MAX_TOKENS_CONFORTAVEL
                  ? "Nome longo — nos títulos das peças ele vai aparecer encurtado."
                  : undefined
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#f1f5f9",
                border: `1px solid ${
                  tokensDeConteudo(item).length > MAX_TOKENS_CONFORTAVEL ? "#fcd34d" : "#e2e8f0"
                }`,
                borderRadius: 999,
                padding: "4px 6px 4px 12px",
                fontSize: 13,
                color: "#0f172a",
              }}
            >
              {item}
              <button
                type="button"
                onClick={() => removeProductItem(i)}
                aria-label={`Remover ${item}`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  fontSize: 15,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {/* AVISO, não bloqueio — ver a nota de MAX_TOKENS_CONFORTAVEL acima.
          Não contradiz a orientação de ser específico logo acima: o pedido aqui
          é cortar o RECHEIO (preposição, complemento genérico), nunca a palavra
          que distingue um produto do irmão dele. */}
      {products.some((p) => tokensDeConteudo(p).length > MAX_TOKENS_CONFORTAVEL) && (
        <p
          style={{
            fontSize: 11,
            color: "#92400e",
            margin: 0,
            lineHeight: 1.45,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            padding: "8px 10px",
          }}
        >
          Os itens destacados em amarelo são longos para caber no título de uma peça — nas peças
          eles vão aparecer encurtados. Se quiser controlar como, encurte aqui mantendo a palavra
          que distingue: <strong>&quot;Bomba de transferência do óleo do câmbio&quot;</strong> →{" "}
          <strong>&quot;Bomba de óleo&quot;</strong>. Não é obrigatório, e nomes longos continuam
          funcionando.
        </p>
      )}
      {products.length < MAX_PRODUCTS && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            value={newProductItem}
            onChange={(e) => {
              setNewProductItem(e.target.value);
              // Editar o texto invalida uma sugestão pendente (era de outro texto).
              if (suggestion) setSuggestion(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addProductItem();
              }
            }}
            disabled={checking}
            placeholder="Ex.: Ração para filhotes (evite genérico, tipo só 'Ração')"
            style={{ flex: "1 1 160px", minWidth: 0 }}
          />
          <button
            type="button"
            onClick={addProductItem}
            disabled={!newProductItem.trim() || checking}
            style={{
              background: "#0f172a",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "0 16px",
              minHeight: 40,
              fontWeight: 700,
              fontSize: 14,
              cursor: newProductItem.trim() && !checking ? "pointer" : "not-allowed",
              opacity: newProductItem.trim() && !checking ? 1 : 0.5,
              flexShrink: 0,
            }}
          >
            {checking ? "Verificando..." : "+ Adicionar"}
          </button>
        </div>
      )}
      {suggestion && (
        <div
          style={{
            background: "#f1f5f9",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: 12,
            display: "grid",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, color: "#64748b" }}>
            Sugestão de correção:{" "}
            <strong style={{ color: "#0f172a" }}>{suggestion.corrected}</strong>
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => commitProductItem(suggestion.corrected)}
              style={{
                background: "#0f172a",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "0 14px",
                minHeight: 36,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Usar sugestão
            </button>
            <button
              type="button"
              onClick={() => commitProductItem(suggestion.original)}
              style={{
                background: "#fff",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "0 14px",
                minHeight: 36,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Manter como digitei
            </button>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                fontSize: 13,
                cursor: "pointer",
                padding: "0 4px",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {!productsValid && (
        <span style={{ fontSize: 12, color: "#dc2626" }}>
          Adicione pelo menos {MIN_PRODUCTS - products.length} item
          {MIN_PRODUCTS - products.length === 1 ? "" : "s"} para salvar o Kit.
        </span>
      )}
    </div>
  );
}
