import { useEffect } from 'react';
import { Lightbulb, Zap, Camera, Layers, Shuffle, VolumeX, type LucideIcon } from 'lucide-react';
import { getRecommendedMoods, templateMoods } from '../../data/templateCatalog';
import { MoodCode, Segment } from '../../types';

const MOOD_ICONS: Record<MoodCode, LucideIcon> = {
  'OP-01': Lightbulb,
  'OP-02': Zap,
  'OP-03': Camera,
  'OP-04': Layers,
  'OP-05': Shuffle,
  'OP-06': VolumeX,
};

interface Props {
  segment: Segment;
  selected: MoodCode;
  onSelect: (code: MoodCode) => void;
}

export default function TemplateChooser({ segment, selected, onSelect }: Props) {
  const moods = getRecommendedMoods(segment);

  useEffect(() => {
    const first = moods.find(m => m.recommendedFor.includes(segment));
    if (first) onSelect(first.code);
  }, [segment]);
  return (
    <section className="panel">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Forma visual</span>
          <h2>O que você quer comunicar hoje?</h2>
        </div>
      </div>
      <div className="moodGrid">
        {moods.map((mood) => (
          <button
            key={mood.code}
            className={`moodCard ${selected === mood.code ? 'active' : ''}`}
            onClick={() => onSelect(mood.code)}
            type="button"
          >
            <span className="moodMini" style={{ background: mood.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(() => { const Icon = MOOD_ICONS[mood.code]; return Icon ? <Icon size={22} color="white" strokeWidth={1.8} /> : null; })()}
            </span>
            <strong>{mood.code} · {mood.name}</strong>
            {mood.recommendedFor.includes(segment) && <em>recomendado</em>}
          </button>
        ))}
      </div>
    </section>
  );
}
