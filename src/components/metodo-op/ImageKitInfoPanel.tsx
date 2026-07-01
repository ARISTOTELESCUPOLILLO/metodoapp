// Painel estático "Como usar" do Kit Imagem — extraído de MetodoOpApp.tsx
// (PLANO_V2 Fase 9.1). Conteúdo movido 1:1, sem props (sem estado).
export function ImageKitInfoPanel() {
  return (
    <div className="panel" style={{ padding: 24 }}>
      <span className="eyebrow">Como usar</span>
      <h2 style={{ marginTop: 4 }}>Kit Imagem</h2>
      <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
        Suba até 2 avatares, 2 cenários, 8 produtos, e também as fotos de Fato e Venda. As imagens
        ficam salvas na sua conta e ficam disponíveis em qualquer dispositivo onde você entrar.
        Depois, no <strong>Método OP</strong> e no <strong>Post Único</strong>, marque quais delas a
        IA deve usar como referência visual ao montar a peça. A numeração dos produtos é fixa:
        apagar o produto 3 deixa o slot vazio até você subir outro.
      </p>
    </div>
  );
}
