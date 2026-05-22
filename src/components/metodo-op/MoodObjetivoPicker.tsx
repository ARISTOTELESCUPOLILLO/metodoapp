import { MoodCode, PostUnicoDirecao, PostUnicoObjetivo } from '../../types';

const OBJETIVOS: { code: PostUnicoObjetivo; label: string; desc: string }[] = [
  { code: 'promocao', label: 'Promoção', desc: 'Oferta, campanha comercial' },
  { code: 'homenagem', label: 'Homenagem', desc: 'Pessoa, data, conquista' },
  { code: 'aviso', label: 'Aviso', desc: 'Comunicado institucional' },
  { code: 'oportunidade', label: 'Oportunidade', desc: 'Momento único, urgência' },
  { code: 'institucional', label: 'Institucional', desc: 'Posicionamento, propósito, marca' },
];

const MOODS: { code: MoodCode; label: string }[] = [
  { code: 'OP-01', label: 'Clareza' },
  { code: 'OP-04', label: 'Fragmento' },
  { code: 'OP-03', label: 'Instante' },
  { code: 'OP-05', label: 'Desvio' },
  { code: 'OP-02', label: 'Impacto' },
  { code: 'OP-06', label: 'Silêncio' },
];

interface Props {
  objetivo: PostUnicoObjetivo;
  onObjetivo: (o: PostUnicoObjetivo) => void;
  direcao: PostUnicoDirecao;
  onDirecao: (d: PostUnicoDirecao) => void;
  mood?: MoodCode;
  onMood: (m: MoodCode) => void;
  disabled?: boolean;
}

export default function MoodObjetivoPicker({
  objetivo, onObjetivo, direcao, onDirecao, mood, onMood, disabled,
}: Props) {
  return (
    <>
      <div className="formatBox">
        <strong>Objetivo da peça</strong>
        <div className="sequenceGrid">
          {OBJETIVOS.map(o => (
            <button
              key={o.code}
              type="button"
              disabled={disabled}
              className={`sequenceCard trackCard${objetivo === o.code ? ' active' : ''}`}
              onClick={() => onObjetivo(o.code)}
            >
              <span className="sequenceNum">{o.label}</span>
              <span className="trackDescription">{o.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="formatBox">
        <strong>Direção visual</strong>
        <div className="radioRow">
          <label className="radioLabel">
            <input
              type="radio"
              name={`direcao-${Math.random()}`}
              checked={direcao === 'livre'}
              onChange={() => onDirecao('livre')}
              disabled={disabled}
            />
            Livre — IA decide tudo
          </label>
          <label className="radioLabel">
            <input
              type="radio"
              name={`direcao-${Math.random()}`}
              checked={direcao === 'mood'}
              onChange={() => onDirecao('mood')}
              disabled={disabled}
            />
            Com Mood
          </label>
        </div>

        {direcao === 'mood' && (
          <>
            {!mood && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
                Escolha um mood abaixo para liberar a geração.
              </p>
            )}
            <div className="sequenceGrid" style={{ marginTop: 12 }}>
              {MOODS.map(m => (
                <button
                  key={m.code}
                  type="button"
                  disabled={disabled}
                  className={`sequenceCard${mood === m.code ? ' active' : ''}`}
                  onClick={() => onMood(m.code)}
                >
                  <span className="sequenceNum">{m.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function objetivoLabel(o: PostUnicoObjetivo): string {
  return OBJETIVOS.find(x => x.code === o)?.label || o;
}
