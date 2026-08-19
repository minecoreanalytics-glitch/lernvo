import { describe, it, expect } from 'vitest'
import { markdownToSpeech } from '../services/tts'

describe('markdownToSpeech', () => {
  it('turns markdown into speakable sentences', () => {
    const md = '# Étape 1\n\n- Ouvrir **le ticket**\n- Vérifier `le compte`\n\n[Lien](https://x) et ![img](a.png)\n\n```\ncode\n```\n1. Fin.'
    const out = markdownToSpeech(md)
    expect(out).toContain('Étape 1.')
    expect(out).toContain('Ouvrir le ticket')
    expect(out).not.toMatch(/[*`#\[\]]/)
    expect(out).not.toContain('code')
    expect(out).toContain('Lien et')
  })
})
