import { useState } from 'react';
import { BrandKit, FontPair, LogoPosition, Segment } from '../../types';
import { brandVoiceCatalog, defaultVoice } from '../../data/brandVoice';
import { fileToDataUrl } from '../../utils/file';
import ConfirmDialog from './ConfirmDialog';

const LOGO_POSITIONS: { value: LogoPosition; label: string; hint: string }[] = [
  { value: 'bottom-right',  label: 'Inferior direito', hint: 'Padrão' },
  { value: 'top-center',    label: 'Topo central',     hint: '' },
  { value: 'bottom-center', label: 'Inferior central', hint: '' },
];

function LogoPositionPreview({ position, active }: { position: LogoPosition; active: boolean }) {
  const dot = { width: 10, height: 10, background: active ? '#0f172a' : '#475569', borderRadius: 2, position: 'absolute' as const };
  const style: React.CSSProperties =
    position === 'top-center'    ? { ...dot, top: 6,    left: '50%', transform: 'translateX(-50%)' } :
    position === 'bottom-center' ? { ...dot, bottom: 6, left: '50%', transform: 'translateX(-50%)' } :
                                   { ...dot, bottom: 6, right: 6 };
  return (
    <div style={{ position: 'relative', width: 44, height: 56, border: `1.5px solid ${active ? '#0f172a' : '#cbd5e1'}`, borderRadius: 4, background: '#fff' }}>
      <span style={style} />
    </div>
  );
}

interface Props {
  kit: BrandKit;
  onChange: (kit: BrandKit) => void;
  onSave?: () => void;
  onLoad?: () => void;
  loading?: boolean;
  saving?: boolean;
  saved?: boolean;
}

const FONTS: { value: FontPair; label: string; sample: string }[] = [
  { value: 'Inter',            label: 'Helvética', sample: 'Aa' },
  { value: 'Playfair Display', label: 'Serifada',  sample: 'Aa' },
];

const COLORS_PRESET = [
  '#123a63','#0f172a','#1e3a5f','#1a1a2e',
  '#7c3aed','#0891b2','#059669','#dc2626',
  '#d97706','#f4b000','#e5e7eb','#ffffff',
];

export default function BrandKitForm({ kit, onChange, onSave, onLoad, loading, saving, saved }: Props) {
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);
  const update = <K extends keyof BrandKit>(key: K, value: BrandKit[K]) => onChange({ ...kit, [key]: value });
  const changeSegment = (segment: Segment) => onChange({ ...kit, segment, brandVoice: defaultVoice(segment) });


  return (
    <section className="panel">
      <div className="sectionHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <span className="eyebrow">Base editável</span>
          <h2>Kit de Marca</h2>
        </div>
        {onLoad && (
          <button
            type="button"
            onClick={onLoad}
            disabled={loading || saving}
            style={{ marginLeft: 24, background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 10, padding: '0 16px', minHeight: 40, fontWeight: 700, fontSize: 14, cursor: loading || saving ? 'not-allowed' : 'pointer' }}
            title="Carregar o Kit de Marca que você já salvou"
          >
            {loading ? 'Carregando...' : '↺ Carregar meu Kit'}
          </button>
        )}
      </div>

      <div className="grid2">
        <label>Nome da marca
          <input value={kit.companyName} onChange={(e) => update('companyName', e.target.value)} placeholder="Oficina de Propaganda" />
        </label>
        <label>Segmento
          <select value={kit.segment} onChange={(e) => changeSegment(e.target.value as Segment)}>
            <option value="SERVIÇOS">Serviços</option>
            <option value="VAREJO">Varejo</option>
            <option value="MARCA">Marca</option>
          </select>
        </label>
      </div>

      <div className="grid2">
        <label>Logotipo
          <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) update('logoDataUrl', await fileToDataUrl(file));
          }} />
          {kit.logoDataUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <img src={kit.logoDataUrl} alt="logo" style={{ height: 40, objectFit: 'contain', borderRadius: 8, background: '#f1f5f9', padding: 4 }} />
              <button
                type="button"
                onClick={() => setConfirmRemoveLogo(true)}
                style={{
                  background: '#fff',
                  color: '#b91c1c',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Remover a logomarca atual"
              >
                🗑 Remover logomarca
              </button>
            </div>
          )}
        </label>

        <div>
          <strong style={{ display: 'block', fontSize: 13, color: '#0f172a', marginBottom: 6 }}>
            Posição da logomarca na peça
          </strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {LOGO_POSITIONS.map(p => {
              const active = (kit.logoPosition || 'bottom-right') === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => update('logoPosition', p.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px',
                    border: `2px solid ${active ? '#0f172a' : '#cbd5e1'}`,
                    borderRadius: 10,
                    background: active ? '#f1f5f9' : '#fff',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#0f172a',
                  }}
                  title={`${p.label}${p.hint ? ' — ' + p.hint : ''}`}
                >
                  <LogoPositionPreview position={p.value} active={active} />
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                    {p.label}
                    {p.hint && <small style={{ color: '#64748b', fontWeight: 500 }}>{p.hint}</small>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="checkRow" style={{ alignSelf: 'end', marginBottom: 16 }}>
          <input type="checkbox" checked={kit.logoHasName} onChange={(e) => update('logoHasName', e.target.checked)} />
          Logotipo já contém o nome da marca
        </label>
      </div>

      <div className="colorSection">
        <strong className="colorLabel">Cores da marca</strong>
        <div className="colorGrid">
          {(['primaryColor', 'secondaryColor', 'accentColor'] as const).map((key) => (
            <div key={key} className="colorItem">
              <span className="colorName">{key === 'primaryColor' ? 'Primária' : key === 'secondaryColor' ? 'Secundária' : 'Destaque'}</span>
              <div className="colorRow">
                <input type="color" value={kit[key] || '#f4b000'} onChange={(e) => update(key, e.target.value)} className="colorPicker" />
                <input type="text" value={kit[key] || '#f4b000'} onChange={(e) => update(key, e.target.value)} className="colorHex" placeholder="#000000" />
              </div>
              <div className="colorPresets">
                {COLORS_PRESET.map(c => (
                  <button key={c} type="button" className="colorDot" style={{ background: c, border: kit[key] === c ? '2px solid #f4b000' : '2px solid transparent' }} onClick={() => update(key, c)} title={c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fontSection">
        <strong className="fontLabel">Tipografia</strong>
        <div className="fontGrid">
          {FONTS.map(f => (
            <button key={f.value} type="button"
              className={`fontCard${kit.fontPair === f.value ? ' active' : ''}`}
              onClick={() => update('fontPair', f.value)}
              style={{ fontFamily: f.value }}>
              <span className="fontSample">{f.sample}</span>
              <span className="fontName">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      <label>Tom de voz
        <select value={kit.brandVoice} onChange={(e) => update('brandVoice', e.target.value)}>
          {brandVoiceCatalog[kit.segment].map((voice) => <option key={voice} value={voice}>{voice}</option>)}
        </select>
      </label>

      <label>Atividade principal
        <input
          value={kit.mainActivity || ''}
          onChange={(e) => update('mainActivity', e.target.value)}
          placeholder="Ex.: consultoria de marketing digital para pequenos negócios"
        />
      </label>

      {onSave && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" className="saveBtn" onClick={onSave} disabled={saving || loading}>
            {saving ? 'Salvando...' : saved ? '✓ Kit salvo' : '💾 Salvar Kit'}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmRemoveLogo}
        tone="danger"
        title="Remover logomarca?"
        message="A logomarca atual será removida do formulário. Você precisará subir uma nova imagem antes de clicar em Salvar Kit para confirmar a alteração."
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        onConfirm={() => {
          update('logoDataUrl', undefined);
          setConfirmRemoveLogo(false);
        }}
        onCancel={() => setConfirmRemoveLogo(false)}
      />
    </section>
  );
}
