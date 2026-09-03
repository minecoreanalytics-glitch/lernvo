import { describe, expect, it } from 'vitest';

import { detectBulletIcon, hasSlideMarkers, parseSlides } from './parseSlides';

const body = `## Slide 1: Bienvenue
- **Objectif** : comprendre la procédure
- Étape 1 : ouvrir le dossier
> Note présentateur : insister sur la sécurité
> et sur les délais

### Slide 2: Résultats attendus
Taux de réussite supérieur à 90 %
- Attention aux exceptions`;

describe('parseSlides', () => {
  it('detects the slide grammar used by the web SlideViewer', () => {
    expect(hasSlideMarkers(body)).toBe(true);
    expect(hasSlideMarkers('Plain paragraph text')).toBe(false);
    expect(hasSlideMarkers(null)).toBe(false);
  });

  it('splits into titled slides with bullets, icons and presenter notes', () => {
    const slides = parseSlides(body);
    expect(slides).toHaveLength(2);
    expect(slides[0]?.title).toBe('Bienvenue');
    expect(slides[0]?.bullets).toEqual(['Objectif : comprendre la procédure', 'Étape 1 : ouvrir le dossier']);
    expect(slides[0]?.icons).toEqual(['target', 'zap']);
    expect(slides[0]?.presenterNote).toBe('insister sur la sécurité et sur les délais');
    expect(slides[1]?.title).toBe('Résultats attendus');
    expect(slides[1]?.bullets).toEqual(['Taux de réussite supérieur à 90 %', 'Attention aux exceptions']);
    expect(slides[1]?.icons).toEqual(['chart', 'alert']);
    expect(slides[1]?.presenterNote).toBe('');
  });

  it('maps keywords to icons and falls back to an arrow', () => {
    expect(detectBulletIcon('Sécurité des données')).toBe('shield');
    expect(detectBulletIcon('Un conseil utile')).toBe('lightbulb');
    expect(detectBulletIcon('Bonjour')).toBe('arrow');
  });
});
