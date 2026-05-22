import { getRecommendedMoods, templateMoods } from '../../data/templateCatalog';
import { MoodCode, Segment } from '../../types';

interface Props {
  segment: Segment;
  selected: MoodCode;
  onSelect: (code: MoodCode) => void;
}

export default function TemplateChooser({ segment, selected, onSelect }: Props) {
  const moods = getRecommendedMoods(segment);
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
            <span className="moodMini" style={{ background: mood.color }} />
            <strong>{mood.code} · {mood.name}</strong>
            {mood.recommendedFor.includes(segment) && <em>recomendado</em>}
          </button>
        ))}
      </div>
    </section>
  );
}
