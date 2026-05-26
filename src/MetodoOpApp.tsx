import { useState, useEffect, useRef } from 'react';
import BrandKitForm from './components/metodo-op/BrandKitForm';
import ConfirmDialog from './components/metodo-op/ConfirmDialog';
import ContentForm from './components/metodo-op/ContentForm';

import ResultsView from './components/metodo-op/ResultsView';
import PostUnicoForm from './components/metodo-op/PostUnicoForm';
import PostUnicoResult from './components/metodo-op/PostUnicoResult';
import GenerationProgress from './components/metodo-op/GenerationProgress';
import ImageKitForm from './components/metodo-op/ImageKitForm';
import { defaultVoice } from './data/brandVoice';
import { generateMethodContent } from './services/api';
import { generatePostUnico, generatePostUnicoCaption, type PostUnicoCaption, type PostUnicoReferences } from './services/postUnico';
import { loadKitForUser, saveKitForUser, loadKitServer, saveKitServer } from './services/brandKit';
import { useServerFn } from '@tanstack/react-start';
import { saveKit, loadKit, saveForm, loadForm, clearAll } from './utils/storage';
import { loadImageKit, saveImageKit, loadImageKitAsync, saveImageKitAsync } from './utils/imageKitStorage';
import { BrandKit, ContentFormData, ImageKit, MethodOpResult, MoodCode, PostUnicoFormData, PostUnicoVisualSelection } from './types';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { useImpersonation, stopImpersonation } from './hooks/useImpersonation';
import { buildPlanAccess } from './lib/planAccess';
import { PlanCard } from './components/metodo-op/PlanCard';
import './metodo-op.css';

const defaultKit: BrandKit = {
  companyName: '',
  segment: 'SERVIÇOS',
  logoHasName: true,
  primaryColor: '#123a63',
  secondaryColor: '#0f172a',
  accentColor: '#f4b000',
  fontPair: 'Montserrat',
  brandVoice: defaultVoice('SERVIÇOS'),
  mainActivity: '',
  logoPosition: 'bottom-right',
};

const defaultForm: ContentFormData = {
  companyName: '',
  segment: 'SERVIÇOS',
  audience: 'B2C',
  businessMoment: 'consolidação',
  keyInfo: '',
  brandVoice: defaultVoice('SERVIÇOS'),
  outputMode: 'feed',
  sequenceSize: 3,
  storiesDays: 3,
  storiesQuantity: 3,
  outputFormats: ['feed', 'carrossel', 'reels'],
  track: 'visual',
  mood: 'OP-01',
};

const defaultPostUnico: PostUnicoFormData = {
  companyName: '',
  mainActivity: '',
  keyInfo: '',
  objetivo: 'promocao',
  direcao: 'livre',
};

const POSTUNICO_KEY = 'metodo-op-postunico-v1';
function loadPostUnico(): PostUnicoFormData {
  if (typeof window === 'undefined') return { ...defaultPostUnico };
  try {
    const raw = localStorage.getItem(POSTUNICO_KEY);
    return raw ? { ...defaultPostUnico, ...JSON.parse(raw) } : { ...defaultPostUnico };
  } catch { return { ...defaultPostUnico }; }
}
function savePostUnico(d: PostUnicoFormData) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(POSTUNICO_KEY, JSON.stringify(d)); } catch {}
}

type Modo = 'metodo' | 'postUnico' | 'imageKit';

const defaultVisualSelection: PostUnicoVisualSelection = {
  useAvatar: false,
  avatarSelecionado: 1,
  useCenario: false,
  useProdutos: false,
  produtosSelecionados: [],
  cenarioSelecionado: null,
};

export default function App() {
  const [modo, setModo] = useState<Modo>(() => {
    if (typeof window === 'undefined') return 'metodo';
    try {
      const v = localStorage.getItem('metodo-op-modo');
      if (v === 'postUnico' || v === 'imageKit' || v === 'metodo') return v;
      return 'metodo';
    } catch { return 'metodo'; }
  });
  const [kit, setKit] = useState<BrandKit>(() => loadKit(defaultKit as any) as unknown as BrandKit);
  const [imageKit, setImageKit] = useState<ImageKit>(() => loadImageKit(null));
  const [imageKitSaved, setImageKitSaved] = useState(false);
  const [visualSelection, setVisualSelection] = useState<PostUnicoVisualSelection>(defaultVisualSelection);
  const [mood, setMood] = useState<MoodCode>('OP-01');
  const [result, setResult] = useState<MethodOpResult | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ContentFormData>(() => {
    const loaded = loadForm(defaultForm as any) as unknown as ContentFormData;
    return { ...loaded, track: loaded.track || 'cinematica' };
  });
  const [postUnico, setPostUnico] = useState<PostUnicoFormData>(loadPostUnico);
  const [postUnicoImg, setPostUnicoImg] = useState<string | undefined>();
  const [postUnicoStarted, setPostUnicoStarted] = useState(false);
  const [caption, setCaption] = useState<PostUnicoCaption | undefined>();
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionError, setCaptionError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingKit, setLoadingKit] = useState(false);
  const { user } = useAuth();
  const impersonation = useImpersonation();
  const { profile, slots, isAdmin, isSelfAdmin, loading: profileLoading, refresh: refreshProfile } = useProfile(impersonation?.userId || null);
  const loadKitServerFn = useServerFn(loadKitServer);
  const saveKitServerFn = useServerFn(saveKitServer);
  // Quando impersonando: usa só o status do usuário alvo (não o do admin logado).
  // Assim o admin vê as mesmas restrições de plano que o cliente vê.
  const effectiveAdmin = impersonation ? isAdmin : (isSelfAdmin || isAdmin);
  // Acesso ao conteúdo é sempre baseado nos slots reais — sem bypass de admin.
  // O admin vê sua própria trilha/tamanho, assim como qualquer usuário.
  const planAccess = buildPlanAccess(slots, false);
  const rendersTotal = slots.reduce((s, sl) => s + (sl.rendersLimite || 0), 0);
  const rendersUsadosSum = slots.reduce((s, sl) => s + (sl.rendersUsados || 0), 0);
  const rendersRestantes = Math.max(0, rendersTotal - rendersUsadosSum);
  const imgsTotal = slots.reduce((s, sl) => s + (sl.imgsLimite || 0), 0);
  const imgsUsadasSum = slots.reduce((s, sl) => s + (sl.imgsUsadas || 0), 0);
  const imgsRestantes = Math.max(0, imgsTotal - imgsUsadasSum);
  const geracoesTotal = slots.reduce((s, sl) => s + (sl.geracoesLimite || 0), 0);
  const geracoesUsadasSum = slots.reduce((s, sl) => s + (sl.geracoesUsadas || 0), 0);
  const geracoesRestantes = Math.max(0, geracoesTotal - geracoesUsadasSum);
  const semPlano = slots.length === 0 && !effectiveAdmin;
  const effectiveUserId = impersonation?.userId || user?.id || null;
  // Slot que será usado para arquivar gerações PU: preferência ao slot com plano PU.
  const puSlot = (slots.find(s => /^PU\d+/i.test(s.plan.codigo)) || slots[0])?.key;
  const greetingName = impersonation?.nome || profile?.nome || user?.email || '';
  const ultimoLoginFmt = profile?.ultimo_login
    ? new Date(profile.ultimo_login).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'primeiro acesso';
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message?: string;
    resolve: (v: boolean) => void;
  } | null>(null);

  function askConfirm(title: string, message?: string): Promise<boolean> {
    return new Promise((resolve) => {
      setConfirmState({ title, message, resolve });
    });
  }

  useEffect(() => { saveKit(kit as any); }, [kit]);
  useEffect(() => { saveForm(form as any); }, [form]);
  useEffect(() => { savePostUnico(postUnico); }, [postUnico]);
  useEffect(() => { localStorage.setItem('metodo-op-modo', modo); }, [modo]);

  // Auto-seleciona o modo de acordo com o plano1 do usuário ao logar.
  const modeInitializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!effectiveUserId || !slots.length) return;
    if (modeInitializedForRef.current === effectiveUserId) return;
    modeInitializedForRef.current = effectiveUserId;
    const plano1 = slots.find(s => s.key === 'plano1');
    if (!plano1) return;
    if (/^PU/i.test(plano1.plan.codigo)) {
      setModo('postUnico');
    } else {
      setModo('metodo');
    }
  }, [effectiveUserId, slots]);

  // Quando o usuário (ou impersonação) muda, carrega o kit dele do banco
  // e restaura o conteúdo gerado persistido em localStorage daquele usuário.
  useEffect(() => {
    if (!effectiveUserId) return;
    // Reset imediato pra evitar vazar dados do usuário anterior (impersonação admin).
    // form/postUnico não são namespaced por usuário no localStorage, então precisamos
    // limpá-los em memória ao trocar de "atuando como".
    setForm({ ...defaultForm });
    setPostUnico({ ...defaultPostUnico });
    setKit(defaultKit);
    // Admin impersonando: usa server function que bypassa RLS do Supabase
    const loadFn = impersonation
      ? () => loadKitServerFn({ data: { userId: effectiveUserId } })
      : () => loadKitForUser(effectiveUserId);

    loadFn().then((loaded) => {
      if (loaded) {
        handleKitChange(loaded);
      } else {
        try { localStorage.removeItem('metodo-op-kit-v1'); } catch {}
        try { localStorage.removeItem('metodo-op-logo-v1'); } catch {}
        handleKitChange(defaultKit);
      }
    });
    // Restaura conteúdo gerado persistido para este usuário
    try {
      const r = localStorage.getItem(`metodo-op-result-v1:${effectiveUserId}`);
      setResult(r ? JSON.parse(r) : undefined);
      const pImg = localStorage.getItem(`metodo-op-postunico-img-v1:${effectiveUserId}`);
      setPostUnicoImg(pImg ? JSON.parse(pImg) : undefined);
      const pCap = localStorage.getItem(`metodo-op-postunico-caption-v1:${effectiveUserId}`);
      setCaption(pCap ? JSON.parse(pCap) : undefined);
      const pStarted = localStorage.getItem(`metodo-op-postunico-started-v1:${effectiveUserId}`);
      setPostUnicoStarted(pStarted === 'true');
    } catch {}
    // Carrega o Kit Imagem deste usuário: primeiro do cache local (instantâneo)
    // e depois sincroniza com o backend (autoritativo, sobrevive a troca de aparelho).
    try { setImageKit(loadImageKit(effectiveUserId)); } catch {}
    loadImageKitAsync(effectiveUserId).then((remote) => setImageKit(remote)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  // Persistência por usuário do conteúdo gerado (sobrevive a back/reload).
  // Só limpa quando o cliente clica em "Limpar" (que seta o state pra undefined).
  useEffect(() => {
    if (!effectiveUserId) return;
    const k = `metodo-op-result-v1:${effectiveUserId}`;
    try {
      if (result === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(result));
    } catch {}
  }, [result, effectiveUserId]);
  useEffect(() => {
    if (!effectiveUserId) return;
    const k = `metodo-op-postunico-img-v1:${effectiveUserId}`;
    try {
      if (postUnicoImg === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(postUnicoImg));
    } catch {}
  }, [postUnicoImg, effectiveUserId]);
  useEffect(() => {
    if (!effectiveUserId) return;
    const k = `metodo-op-postunico-caption-v1:${effectiveUserId}`;
    try {
      if (caption === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(caption));
    } catch {}
  }, [caption, effectiveUserId]);
  useEffect(() => {
    if (!effectiveUserId) return;
    const k = `metodo-op-postunico-started-v1:${effectiveUserId}`;
    try { localStorage.setItem(k, postUnicoStarted ? 'true' : 'false'); } catch {}
  }, [postUnicoStarted, effectiveUserId]);


  // Segmento fixado pelo admin — não-admin não pode alterar.
  const lockedSegment = profile?.segmento ? profile.segmento as typeof defaultKit.segment : undefined;

  // Quando o profile chega (ou muda), sincroniza o segment do kit com o do perfil.
  useEffect(() => {
    if (!lockedSegment) return;
    if (kit.segment === lockedSegment) return;
    const voice = defaultVoice(lockedSegment);
    setKit((prev) => ({ ...prev, segment: lockedSegment, brandVoice: voice }));
    setForm((prev) => ({ ...prev, segment: lockedSegment, brandVoice: voice }));
  }, [lockedSegment]); // eslint-disable-line react-hooks/exhaustive-deps

  // Espelha sempre os dados do Kit de Marca no Post Único (campos travados)
  useEffect(() => {
    setPostUnico((prev) => ({
      ...prev,
      companyName: kit.companyName || '',
      mainActivity: kit.mainActivity || '',
    }));
  }, [kit.companyName, kit.mainActivity]);

  function handleKitChange(next: BrandKit) {
    setKit(next);
    setForm((prev) => ({
      ...prev,
      companyName: next.companyName,
      segment: next.segment,
      brandVoice: next.brandVoice,
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      saveKit(kit as any);
      saveForm(form as any);
      if (effectiveUserId) {
        let saved: BrandKit;
        if (impersonation) {
          // Admin atuando como outro usuário: usa server function que bypassa RLS
          saved = await saveKitServerFn({
            data: {
              userId: effectiveUserId,
              companyName: kit.companyName,
              segment: kit.segment,
              primaryColor: kit.primaryColor,
              secondaryColor: kit.secondaryColor,
              accentColor: kit.accentColor,
              fontPair: kit.fontPair,
              brandVoice: kit.brandVoice,
              logoHasName: kit.logoHasName ?? false,
              logoDataUrl: kit.logoDataUrl,
              mainActivity: kit.mainActivity,
              logoPosition: kit.logoPosition || 'bottom-right',
            },
          });
        } else {
          saved = await saveKitForUser(kit, effectiveUserId);
        }
        handleKitChange(saved);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(`Erro ao salvar Kit: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!(await askConfirm('Limpar Kit de Marca', 'Isso vai apagar o Kit de Marca e todos os dados locais. Deseja continuar?'))) return;
    clearAll();
    setKit(defaultKit);
    setForm(defaultForm);
    setPostUnico(defaultPostUnico);
  }

  async function handleLoadKit() {
    if (!effectiveUserId) return;
    setLoadingKit(true);
    try {
      const loaded = impersonation
        ? await loadKitServerFn({ data: { userId: effectiveUserId } })
        : await loadKitForUser(effectiveUserId);
      if (loaded) {
        handleKitChange(loaded);
      } else {
        alert('Você ainda não tem um Kit salvo. Preencha e clique em "Salvar Kit".');
      }
    } catch (e) {
      alert(`Erro ao carregar Kit: ${(e as Error).message}`);
    } finally {
      setLoadingKit(false);
    }
  }

  async function handleClearPostUnico() {
    if (!(await askConfirm('Limpar Post Único', 'Isso vai apagar a informação-chave, a peça gerada e a legenda. Deseja continuar?'))) return;
    setPostUnico({
      ...defaultPostUnico,
      companyName: kit.companyName || '',
      mainActivity: kit.mainActivity || '',
    });
    setPostUnicoImg(undefined);
    setPostUnicoStarted(false);
    setCaption(undefined);
    setCaptionError('');
    setError('');
  }

  async function handleClearMethodResult() {
    if (!(await askConfirm('Limpar conteúdo gerado', 'Isso vai apagar o resultado atual (feed, carrossel, reels, stories). Deseja continuar?'))) return;
    setResult(undefined);
    setError('');
  }

  async function handleClearMethodGeneration() {
    if (!(await askConfirm('Limpar geração de conteúdo', 'Isso vai apagar a informação-chave e o resultado gerado pra você começar de novo. Deseja continuar?'))) return;
    setForm((prev) => ({ ...prev, keyInfo: '' }));
    setResult(undefined);
    setError('');
  }

  async function handleGenerate() {
    setLoading(true);
    setError('');
    setResult(undefined);
    try {
      const generated = await generateMethodContent({
        ...form,
        companyName: kit.companyName,
        segment: kit.segment,
        brandVoice: kit.brandVoice,
        mainActivity: kit.mainActivity || '',
        mood,
      });
      setResult(generated);
      refreshProfile();
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateCaption() {
    setCaptionLoading(true);
    setCaptionError('');
    try {
      const c = await generatePostUnicoCaption({
        ...postUnico,
        companyName: postUnico.companyName || kit.companyName,
        mainActivity: postUnico.mainActivity || kit.mainActivity || '',
      }, { brandVoice: kit.brandVoice });
      setCaption(c);
    } catch (e) {
      setCaptionError(String((e as Error).message || e));
    } finally {
      setCaptionLoading(false);
    }
  }

  async function handleGeneratePostUnico(copy?: { titulo: string; texto: string }) {
    setLoading(true);
    setError('');
    setPostUnicoImg(undefined);
    setPostUnicoStarted(true);
    setCaption(undefined);
    setCaptionError('');
    const data = {
      ...postUnico,
      companyName: postUnico.companyName || kit.companyName,
      mainActivity: postUnico.mainActivity || kit.mainActivity || '',
    };
    // Legenda em paralelo com a imagem — não bloqueia a peça.
    // Aqui debita 1 geração no plano (clique inicial do Post Único).
    setCaptionLoading(true);
    generatePostUnicoCaption(data, { debit: true, brandVoice: kit.brandVoice, preferredSlot: puSlot })
      .then((c) => { setCaption(c); refreshProfile(); })
      .catch((e) => setCaptionError(String((e as Error).message || e)))
      .finally(() => setCaptionLoading(false));
    try {
      // Constrói as referências visuais a partir do Kit Imagem + seleção.
      const references: PostUnicoReferences = {};
      if (visualSelection.useAvatar) {
        const av = visualSelection.avatarSelecionado === 2 ? imageKit.avatar2 : imageKit.avatar;
        if (av) references.avatar = av;
      }
      if (visualSelection.useCenario) {
        const idx = (visualSelection.cenarioSelecionado ?? 1) - 1;
        const c = imageKit.cenarios[idx] || imageKit.cenarios.find((x) => !!x) || null;
        if (c) references.cenario = c;
      }
      if (visualSelection.useProdutos && visualSelection.produtosSelecionados.length) {
        const lista: { num: number; dataUrl: string }[] = [];
        for (const num of visualSelection.produtosSelecionados) {
          const url = imageKit.produtos[num - 1];
          if (url) lista.push({ num, dataUrl: url });
        }
        if (lista.length) references.produtos = lista;
      }
      const hasRefs = !!(references.avatar || references.cenario || references.produtos?.length);
      const dataUrl = await generatePostUnico({ data, kit, copy, references: hasRefs ? references : undefined, preferredSlot: puSlot });
      setPostUnicoImg(dataUrl);
      refreshProfile();
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveImageKit() {
    try {
      // Sobe pro backend (autoritativo) e espelha no cache local.
      const saved = await saveImageKitAsync(imageKit, effectiveUserId);
      setImageKit(saved);
      setImageKitSaved(true);
      setTimeout(() => setImageKitSaved(false), 2000);
    } catch (e) {
      // Fallback: salva pelo menos no cache local pra não perder edições.
      try { saveImageKit(imageKit, effectiveUserId); } catch {}
      const msg = (e as Error)?.name === 'QuotaExceededError'
        ? 'Espaço local cheio — apague alguma imagem do Kit antes de salvar.'
        : `Erro ao salvar Kit Imagem no servidor: ${(e as Error).message}`;
      alert(msg);
    }
  }
  const loadingMessage = modo === 'postUnico' ? 'Gerando peça única...' : 'Gerando conteúdo com o método...';

  return (
    <>
    <main className="appShell">
      <header className="hero">
        <span className="eyebrow mb-0 mt-[10px]">Organiza o conteúdo, gera a imagem e a legenda no app.</span>
        <h1 style={{ fontWeight: 900 }}><span style={{ color: '#ffffff' }}>MÉTODO</span> <span style={{ color: '#f4b000' }}>OP</span></h1>
        {greetingName && (
          <div style={{ color: 'rgba(255,255,255,.78)', fontSize: 13, marginTop: 4, fontWeight: 500 }}>
            Olá, <strong style={{ color: '#fff' }}>{greetingName}</strong> · Último acesso: {ultimoLoginFmt}
          </div>
        )}

        {/* ── Cards de plano ── */}
        <div style={{ marginTop: 10 }}>
          {!profileLoading && (slots.length > 0 ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {effectiveAdmin && (
                <span style={{ background: '#f4b000', color: '#0f213f', padding: '3px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  Admin
                </span>
              )}
              {slots.map((s) => <PlanCard key={s.key} slot={s} />)}
            </div>
          ) : effectiveAdmin ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ background: '#f4b000', color: '#0f213f', padding: '3px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Admin</span>
              <span style={{ background: '#1e293b', color: '#94a3b8', padding: '3px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>Sem plano</span>
            </div>
          ) : (
            <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '3px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
              Sem plano ativo — fale com o admin
            </span>
          ))}
        </div>

        <div className="modoSwitch" role="tablist" aria-label="Modo de geração">
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'metodo'}
            className={`modoBtn${modo === 'metodo' ? ' active' : ''}`}
            onClick={() => setModo('metodo')}
          >
            Método OP
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'postUnico'}
            className={`modoBtn${modo === 'postUnico' ? ' active' : ''}`}
            onClick={() => setModo('postUnico')}
          >
            Post Único
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'imageKit'}
            className={`modoBtn${modo === 'imageKit' ? ' active' : ''}`}
            onClick={() => setModo('imageKit')}
          >
            Kit Imagem
          </button>
        </div>

        {impersonation && (
          <div className="heroActions">
            <button
              className="clientBtn"
              type="button"
              onClick={() => { stopImpersonation(); window.location.reload(); }}
              style={{ background: '#fde68a', color: '#78350f', borderColor: '#f59e0b' }}
              title="Sair do modo Atuar como"
            >
              ⏻ Sair de "atuando como {impersonation.nome}"
            </button>
          </div>
        )}
      </header>

      <div className="layout">
        <div className="leftCol">
          <BrandKitForm kit={kit} onChange={handleKitChange} onSave={handleSave} onLoad={handleLoadKit} onClear={handleClear} loading={loadingKit} saving={saving} saved={saved} lockedSegment={lockedSegment} />
          {modo === 'metodo' && (
            <ContentForm
              data={form}
              onChange={setForm}
              onGenerate={handleGenerate}
              onClear={handleClearMethodGeneration}
              loading={loading}
              segment={kit.segment}
              mood={mood}
              onMoodChange={setMood}
              rendersRestantes={rendersRestantes}
              rendersTotal={rendersTotal}
              imgsRestantes={imgsRestantes}
              imgsTotal={imgsTotal}
              geracoesRestantes={geracoesRestantes}
              geracoesTotal={geracoesTotal}
              semPlano={semPlano}
              planAccess={planAccess}
            />
          )}
          {modo === 'postUnico' && (
            <PostUnicoForm
              data={postUnico}
              kit={kit}
              imageKit={imageKit}
              visualSelection={visualSelection}
              onVisualSelectionChange={setVisualSelection}
              onChange={setPostUnico}
              onGenerate={handleGeneratePostUnico}
              onClear={handleClearPostUnico}
              loading={loading}
              geracoesRestantes={geracoesRestantes}
              geracoesTotal={geracoesTotal}
              semPlano={semPlano}
              hasPostPlano={planAccess.hasPostUnico}
              puSlot={puSlot}
            />
          )}
          {modo === 'imageKit' && (
            <ImageKitForm
              kit={imageKit}
              onChange={setImageKit}
              onSave={handleSaveImageKit}
              saved={imageKitSaved}
            />
          )}
        </div>
        <div className="rightCol">
          {error && <div className="errorBox">{error}</div>}
          {loading && modo === 'postUnico' ? (
            <GenerationProgress active={loading} expectedMs={60_000} />
          ) : loading && modo === 'metodo' ? (
            <div className="loadingBox">
              <div className="spinner" />
              <p>{loadingMessage}</p>
            </div>
          ) : null}
          {/* ResultsView fica sempre montado para não perder imagens geradas ao trocar de aba */}
          <div style={{ display: modo === 'metodo' ? undefined : 'none' }}>
            <ResultsView result={result} kit={kit} mood={mood} onClear={handleClearMethodResult} imageKit={imageKit} sequenceSize={form.sequenceSize} onImageGenerated={refreshProfile} />
          </div>
          {modo === 'postUnico' && (
            <PostUnicoResult
              imageDataUrl={postUnicoImg}
              companyName={kit.companyName}
              onRegenerate={handleGeneratePostUnico}
              regenerating={loading}
              caption={caption}
              captionLoading={captionLoading}
              captionError={captionError}
              onRegenerateCaption={handleGenerateCaption}
              onClear={handleClearPostUnico}
              started={postUnicoStarted}
              slot={puSlot}
            />
          )}
          {modo === 'imageKit' && (
            <div className="panel" style={{ padding: 24 }}>
              <span className="eyebrow">Como usar</span>
              <h2 style={{ marginTop: 4 }}>Kit Imagem</h2>
              <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
                Suba até 2 avatares, 3 cenários e 8 produtos. As imagens ficam salvas na sua conta
                e ficam disponíveis em qualquer dispositivo onde você entrar. Depois, na aba <strong>Post Único</strong>,
                marque quais delas a IA deve usar como referência visual ao montar a peça. A numeração dos produtos
                é fixa: apagar o produto 3 deixa o slot vazio até você subir outro.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
    <ConfirmDialog
      open={!!confirmState}
      title={confirmState?.title || ''}
      message={confirmState?.message}
      confirmLabel="Limpar"
      cancelLabel="Cancelar"
      tone="danger"
      onConfirm={() => {
        const r = confirmState?.resolve;
        setConfirmState(null);
        r?.(true);
      }}
      onCancel={() => {
        const r = confirmState?.resolve;
        setConfirmState(null);
        r?.(false);
      }}
    />
    </>
  );
}
