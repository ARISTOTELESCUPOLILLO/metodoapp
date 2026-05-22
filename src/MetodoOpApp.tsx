import { useState, useEffect } from 'react';
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
  sequenceSize: 6,
  storiesDays: 3,
  storiesQuantity: 3,
  outputFormats: ['feed', 'carrossel', 'reels'],
  track: 'cinematica',
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
  const { profile, slots, isAdmin, isSelfAdmin, refresh: refreshProfile } = useProfile(impersonation?.userId || null);
  const loadKitServerFn = useServerFn(loadKitServer);
  const saveKitServerFn = useServerFn(saveKitServer);
  // Se o admin logado está atuando como outro usuário, mantém acesso total
  const effectiveAdmin = isSelfAdmin || isAdmin;
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
  const planAccess = buildPlanAccess(slots, effectiveAdmin);
  const effectiveUserId = impersonation?.userId || user?.id || null;
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
    generatePostUnicoCaption(data, { debit: true, brandVoice: kit.brandVoice })
      .then((c) => { setCaption(c); refreshProfile(); })
      .catch((e) => setCaptionError(String((e as Error).message || e)))
      .finally(() => setCaptionLoading(false));
    try {
      // Constrói as referências visuais a partir do Kit Imagem + seleção.
      const references: PostUnicoReferences = {};
      if (visualSelection.useAvatar && imageKit.avatar) references.avatar = imageKit.avatar;
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
      const dataUrl = await generatePostUnico({ data, kit, copy, references: hasRefs ? references : undefined });
      setPostUnicoImg(dataUrl);
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          <span style={{ color: 'rgba(255,255,255,.65)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Seus planos:
          </span>
          {effectiveAdmin ? (
            <span style={{ background: '#f4b000', color: '#0f213f', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
              Ilimitado (admin)
            </span>
          ) : slots.length === 0 ? (
            <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
              Sem plano ativo — fale com o admin
            </span>
          ) : (
            slots.map((s) => {
              const labelPrefix = s.key === 'bonus' ? 'Bônus · ' : '';
              const tooltip = `${s.plan.nome}${s.imgsLimite > 0 ? ` · imgs ${s.imgsUsadas}/${s.imgsLimite}` : ''}${s.geracoesLimite > 0 ? ` · ger ${s.geracoesUsadas}/${s.geracoesLimite}` : ''}`;
              return (
                <span
                  key={s.key}
                  title={tooltip}
                  style={{
                    background: s.key === 'bonus' ? 'rgba(244,176,0,.18)' : 'rgba(255,255,255,.12)',
                    color: '#fff',
                    border: `1px solid ${s.key === 'bonus' ? 'rgba(244,176,0,.55)' : 'rgba(255,255,255,.25)'}`,
                    padding: '3px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {labelPrefix}{s.plan.codigo} · {s.plan.nome}
                </span>
              );
            })
          )}
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

        <div className="heroActions">
          {impersonation && (
            <button
              className="clientBtn"
              type="button"
              onClick={() => { stopImpersonation(); window.location.reload(); }}
              style={{ background: '#fde68a', color: '#78350f', borderColor: '#f59e0b' }}
              title="Sair do modo Atuar como"
            >
              ⏻ Sair de "atuando como {impersonation.nome}"
            </button>
          )}
          <button className="clearBtn" type="button" onClick={handleClear}>
            Limpar
          </button>
        </div>
      </header>

      <div className="layout">
        <div className="leftCol">
          <BrandKitForm kit={kit} onChange={handleKitChange} onSave={handleSave} onLoad={handleLoadKit} loading={loadingKit} saving={saving} saved={saved} />
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
              isAdmin={effectiveAdmin}
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
              isAdmin={effectiveAdmin}
              hasPostPlano={planAccess.hasPostUnico}
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
          {modo === 'metodo' && (
            <ResultsView result={result} kit={kit} mood={mood} onClear={handleClearMethodResult} imageKit={imageKit} sequenceSize={form.sequenceSize} />
          )}
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
            />
          )}
          {modo === 'imageKit' && (
            <div className="panel" style={{ padding: 24 }}>
              <span className="eyebrow">Como usar</span>
              <h2 style={{ marginTop: 4 }}>Kit Imagem</h2>
              <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
                Suba até 1 avatar, 2 cenários e 8 produtos. As imagens ficam salvas na sua conta
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
