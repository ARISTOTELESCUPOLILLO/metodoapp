import { Segment, TemplateMood } from '../types';

export const templateMoods: TemplateMood[] = [
  { code: 'OP-01', name: 'Clareza', intent: 'explicar com calma', recommendedFor: ['SERVIÇOS'], color: '#2563eb' },
  { code: 'OP-02', name: 'Impacto', intent: 'parar o scroll', recommendedFor: ['VAREJO', 'SERVIÇOS'], color: '#f97316' },
  { code: 'OP-03', name: 'Instante', intent: 'mostrar o real', recommendedFor: ['VAREJO'], color: '#d97706' },
  { code: 'OP-04', name: 'Fragmento', intent: 'comparar ideias', recommendedFor: ['SERVIÇOS', 'VAREJO', 'MARCA'], color: '#7c3aed' },
  { code: 'OP-05', name: 'Desvio', intent: 'provocar percepção', recommendedFor: ['MARCA'], color: '#065f46' },
  { code: 'OP-06', name: 'Silêncio', intent: 'elevar percepção', recommendedFor: ['MARCA'], color: '#a16207' },
];

export function getRecommendedMoods(segment: Segment) {
  return [...templateMoods].sort((a, b) => {
    const ar = a.recommendedFor.includes(segment) ? 0 : 1;
    const br = b.recommendedFor.includes(segment) ? 0 : 1;
    return ar - br;
  });
}
