// Tipos canônicos de seleção visual — UMA definição compartilhada entre:
//   PostUnicoVisualSelection (types.ts), SelecaoDireta (regenerateWithKit.ts)
//   e PostUnicoComposicaoVisual (componente de UI).
//
// Regra: nenhum outro arquivo declara esses shapes inline.

/** Personagem criado sem foto de avatar — representa público-alvo ou emissor. */
export interface PersonagemSemAvatar {
  ativo: boolean;
  // Presente quando o usuário define explicitamente no formulário.
  // Opcional no motor (que usa forcedGender/balanceamento quando ausente).
  genero?: "mulher" | "homem";
  // Faixa textual ("25–35 anos"). Opcional no motor (usa faixaEtaria do form).
  idade?: string;
  // Veste esse personagem com o uniforme do Kit de Marca (só tem efeito quando
  // kit.uniformeDataUrl está cadastrado e o usuário escolhe que ele é o emissor).
  comUniforme?: boolean;
}

/** Seleção direta de imagens do Kit para uma peça específica.
 *  Substitui o sistema legado de `elemento` (avatar/produto/cenario/...).
 */
export interface SelecaoDireta {
  usarAvatar: boolean;
  // Qual avatar usar: 1 = principal, 2 = avatar 2. Default: 1.
  avatarNum?: 1 | 2 | null;
  // Usa a foto de fachada do Kit Imagem (slot próprio, fora do pool de cenários).
  usarFachada?: boolean;
  // Número (1..2) do cenário do Kit a usar. null = sem cenário.
  cenarioNum?: number | null;
  // Números (1..8) dos produtos selecionados.
  produtosNums?: number[];
  // Quando true, este card específico deve mostrar DETALHE/RECORTE do produto
  // (distribuição do carrossel VAREJO: 1ª/última = produto inteiro, meio = detalhe).
  produtoDetalhe?: boolean;
  // Veste o avatar com a foto de uniforme do Kit de Marca.
  useUniforme?: boolean;
  personagemSemAvatar?: PersonagemSemAvatar;
  // Peça sem nenhuma pessoa na imagem (PU). Exclusivo com usarAvatar e com
  // personagemSemAvatar.ativo — ver core/semPersonagem.ts.
  semPersonagem?: boolean;
  // Os produtos selecionados são telas/dispositivos cujo conteúdo exibido é a
  // identidade do produto — suspende a regra global de desfoque de tela.
  produtoTelaInformativa?: boolean;
}
