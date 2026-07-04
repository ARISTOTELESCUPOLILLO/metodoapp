// Estado e lógica do bloco "Usar Imagens de Referência" (policy efetiva,
// disponibilidade no Kit, seleção do usuário persistida, geração com
// referências) — extraído de UsoReferenciasDia.tsx (PLANO_V2 Fase 9.1).
// Lógica movida 1:1, sem mudança de comportamento.
import { useEffect, useMemo, useState } from "react";
import { lsGetRaw, lsSetRaw } from "../../../lib/storage/store";
import type { BrandKit, ImageKit, MoodCode } from "../../../types";
import { regenerateWithKit } from "../../../services/regenerateWithKit";
import type { ModeloOP, SlotFormato, SlotPersonalizacao } from "../../../core/personalizacaoMop";
import { policyComExtras, policyPorFormato, type RefPolicy } from "../../../core/referenciasPolicy";
import type { PersonagemGender } from "../../../core/visualDirection";

interface Params {
  segmento: BrandKit["segment"];
  modelo: ModeloOP | null;
  formato: SlotFormato;
  posicao: number;
  cardCarrossel?: number;
  extrasCarrossel: number;
  kit: BrandKit;
  imageKit: ImageKit;
  mood: MoodCode;
  titulo?: string;
  texto?: string;
  imagePrompt?: string;
  leituraCenica?: {
    intencao?: string;
    personagem?: string;
    ambiente?: string;
    expressao?: string;
    clima?: string;
    composicao?: string;
  };
  formatoOverride?: "post" | "reels";
  onGerou: (
    dataUrl: string,
    info: { cobrouCarrosselProduto: boolean; produtoNum?: number },
  ) => void;
  storageKey: string;
  userId?: string | null;
  forcedGender?: PersonagemGender;
  anchoraPersonagem?: string;
  ancoragePapel?: string;
  clothingSeed?: number;
}

export function useUsoReferenciasState(params: Params) {
  const {
    segmento,
    modelo,
    formato,
    posicao,
    cardCarrossel,
    extrasCarrossel,
    kit,
    imageKit,
    mood,
    titulo,
    texto,
    imagePrompt,
    leituraCenica,
    formatoOverride,
    onGerou,
    storageKey,
    userId,
    forcedGender,
    anchoraPersonagem,
    ancoragePapel,
    clothingSeed,
  } = params;

  // Policy efetiva (com extras de carrossel quando se aplica)
  const policyBase = useMemo(
    () => policyPorFormato(segmento, formato, modelo),
    [segmento, formato, modelo],
  );
  const policy: RefPolicy = useMemo(
    () => policyComExtras(policyBase, { segmento, formato, modelo, extrasCarrossel }),
    [policyBase, segmento, formato, modelo, extrasCarrossel],
  );
  // (extra de carrossel já está embutido na `policy.produtos` via policyComExtras)

  // Disponibilidade real no Kit
  const cenariosDisp = useMemo(
    () =>
      imageKit.cenarios.map((c, i) => (c ? i + 1 : null)).filter((n): n is number => n !== null),
    [imageKit.cenarios],
  );
  const produtosDisp = useMemo(
    () =>
      imageKit.produtos.map((p, i) => (p ? i + 1 : null)).filter((n): n is number => n !== null),
    [imageKit.produtos],
  );
  const temAlguma =
    (policy.avatar && (!!imageKit.avatar || !!imageKit.avatar2)) ||
    (policy.fachada && !!imageKit.fachada) ||
    (policy.cenarios > 0 && cenariosDisp.length > 0) ||
    (policy.produtos > 0 && produtosDisp.length > 0);

  // Estado UI persistido
  const [enabled, setEnabled] = useState<boolean>(false);
  // Qual avatar está marcado (1, 2 ou nenhum). Único — só 1 avatar por geração.
  const [avatarNum, setAvatarNum] = useState<number | null>(null);
  const [usarFachada, setUsarFachada] = useState(false);
  const [cenarioNum, setCenarioNum] = useState<number | null>(null);
  const [produtosNums, setProdutosNums] = useState<number[]>([]);
  const [useUniforme, setUseUniforme] = useState(false);
  const [produtoTelaInformativa, setProdutoTelaInformativa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate do localStorage
  useEffect(() => {
    try {
      const raw = lsGetRaw(storageKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.enabled === "boolean") setEnabled(s.enabled);
        if (typeof s.avatarNum === "number" || s.avatarNum === null) {
          setAvatarNum(s.avatarNum);
        } else if (typeof s.usarAvatar === "boolean") {
          // Migração do formato antigo (boolean) → avatarNum (1|2|null).
          setAvatarNum(s.usarAvatar ? 1 : null);
        }
        if (typeof s.usarFachada === "boolean") setUsarFachada(s.usarFachada);
        if (typeof s.cenarioNum === "number" || s.cenarioNum === null) setCenarioNum(s.cenarioNum);
        if (Array.isArray(s.produtosNums)) setProdutosNums(s.produtosNums);
        if (typeof s.useUniforme === "boolean") setUseUniforme(s.useUniforme);
        if (typeof s.produtoTelaInformativa === "boolean") {
          setProdutoTelaInformativa(s.produtoTelaInformativa);
        }
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  // Persist
  useEffect(() => {
    lsSetRaw(
      storageKey,
      JSON.stringify({
        enabled,
        avatarNum,
        usarFachada,
        cenarioNum,
        produtosNums,
        useUniforme,
        produtoTelaInformativa,
      }),
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("uso-ref:changed", { detail: { key: storageKey } }));
    }
  }, [
    enabled,
    avatarNum,
    usarFachada,
    cenarioNum,
    produtosNums,
    useUniforme,
    produtoTelaInformativa,
    storageKey,
  ]);

  // Remove fantasmas: produtos marcados que não existem mais no Kit (foto
  // deletada/reordenada desde a última seleção) — sem isso o badge de ordem
  // fica deslocado (ex.: "4"/"5" em vez de "1"/"2") e a distribuição no
  // carrossel aponta pra um índice que não existe mais, deixando o card sem
  // produto na geração final.
  useEffect(() => {
    setProdutosNums((prev) => {
      const filtered = prev.filter((n) => produtosDisp.includes(n));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [produtosDisp]);

  function toggleProduto(n: number) {
    setProdutosNums((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= policy.produtos) return prev; // no limite: precisa desmarcar antes de trocar
      return [...prev, n];
    });
  }
  const produtosNoLimite = produtosNums.length >= policy.produtos;

  const totalSelecionado =
    (avatarNum != null ? 1 : 0) +
    (usarFachada ? 1 : 0) +
    (cenarioNum != null ? 1 : 0) +
    produtosNums.length;
  const podeGerar = !busy && enabled && totalSelecionado > 0;

  // A distribuição "1 produto por card" do carrossel é feita pelo bloco
  // consolidado em ResultsView.tsx (selecaoParaCard/distributeProduto) —
  // este componente nunca é instanciado com cardCarrossel (sempre `compact`
  // para carrossel, com o disparo de geração via footerAction), então usa
  // sempre a seleção tal como o usuário marcou.
  const produtosNumsParaUso = produtosNums;

  async function handleGerar() {
    if (!podeGerar) return;
    setBusy(true);
    setError(null);
    try {
      const slot: SlotPersonalizacao = {
        formato,
        posicao,
        elemento: "avatar", // ignorado pois selecaoDireta tem precedência
        cardCarrossel,
        motivo: "",
      };
      const url = await regenerateWithKit({
        slot,
        kit,
        imageKit,
        mood,
        keyInfo: `${titulo || ""}. ${imagePrompt || ""}`.slice(0, 500),
        titulo,
        texto,
        imagePrompt,
        leituraCenica,
        forcedGender,
        anchoraPersonagem,
        ancoragePapel,
        clothingSeed,
        formato: formatoOverride,
        selecaoDireta: {
          usarAvatar: avatarNum != null,
          avatarNum: avatarNum as 1 | 2 | null,
          usarFachada,
          cenarioNum: cenarioNum,
          produtosNums: produtosNumsParaUso,
          useUniforme: avatarNum != null && useUniforme,
          produtoTelaInformativa: produtosNumsParaUso.length > 0 && produtoTelaInformativa,
        },
        userId,
        modelo,
      });
      onGerou(url, {
        cobrouCarrosselProduto: false,
        produtoNum: produtosNumsParaUso[0],
      });
    } catch (e) {
      setError((e as Error).message || "Falha ao gerar com referências.");
    } finally {
      setBusy(false);
    }
  }

  return {
    policy,
    cenariosDisp,
    produtosDisp,
    temAlguma,
    enabled,
    setEnabled,
    avatarNum,
    setAvatarNum,
    usarFachada,
    setUsarFachada,
    cenarioNum,
    setCenarioNum,
    produtosNums,
    toggleProduto,
    produtosNoLimite,
    useUniforme,
    setUseUniforme,
    produtoTelaInformativa,
    setProdutoTelaInformativa,
    busy,
    error,
    podeGerar,
    handleGerar,
  };
}
