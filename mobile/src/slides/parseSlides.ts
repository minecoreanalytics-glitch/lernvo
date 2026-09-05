// Same slide grammar as the web SlideViewer: blocks introduced by "Slide N:" (with or
// without markdown heading marks), first line = title, "- " lines = bullets, blockquote
// "> Note présentateur:" = speaker note.

export type Slide = Readonly<{
  title: string;
  bullets: string[];
  icons: BulletIcon[];
  presenterNote: string;
}>;

export type BulletIcon =
  | 'target'
  | 'alert'
  | 'zap'
  | 'users'
  | 'chart'
  | 'shield'
  | 'lightbulb'
  | 'check'
  | 'book'
  | 'arrow';

const SLIDE_MARKER = /###?\s*Slide\s*\d+\s*:\s*/i;

export function hasSlideMarkers(body: string | null | undefined): boolean {
  return Boolean(body && SLIDE_MARKER.test(body));
}

export function detectBulletIcon(text: string): BulletIcon {
  const lower = text.toLowerCase();
  if (/objectif|\bbut\b|cible|goal|target/.test(lower)) return 'target';
  if (/important|attention|critique|urgent|warning/.test(lower)) return 'alert';
  if (/étape|etape|processus|procédure|procedure|step/.test(lower)) return 'zap';
  if (/équipe|equipe|agent|responsable|acteur|chef|team/.test(lower)) return 'users';
  if (/résultat|resultat|performance|taux|rapport|result/.test(lower)) return 'chart';
  if (/sécurité|securite|protection|conformité|conformite|security/.test(lower)) return 'shield';
  if (/conseil|astuce|recommandation|tip/.test(lower)) return 'lightbulb';
  if (/succès|succes|réussi|reussi|complété|complete|validé|valide/.test(lower)) return 'check';
  if (/formation|connaissance|apprendre|learn|training/.test(lower)) return 'book';
  return 'arrow';
}

function stripInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1').trim();
}

export function parseSlides(body: string): Slide[] {
  const blocks = body.split(SLIDE_MARKER).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split('\n');
    const title = stripInline((lines[0] ?? '').replace(/^#+\s*/, ''));
    const bullets: string[] = [];
    const icons: BulletIcon[] = [];
    let presenterNote = '';
    let inNote = false;

    for (const raw of lines.slice(1)) {
      const line = raw.trim();
      if (/^>\s*Note\s*(présentateur|presentateur|speaker)?\s*:/i.test(line)) {
        inNote = true;
        presenterNote = line.replace(/^>\s*Note\s*(présentateur|presentateur|speaker)?\s*:\s*/i, '');
        continue;
      }
      if (inNote) {
        if (line.startsWith('>')) presenterNote += ` ${line.replace(/^>\s*/, '')}`;
        else if (line === '') inNote = false;
        else presenterNote += ` ${line}`;
        continue;
      }
      if (/^[-*•]\s*/.test(line)) {
        const text = stripInline(line.replace(/^[-*•]\s*/, ''));
        if (text) {
          bullets.push(text);
          icons.push(detectBulletIcon(text));
        }
      } else if (line.length > 0) {
        const text = stripInline(line.replace(/^#+\s*/, ''));
        bullets.push(text);
        icons.push(detectBulletIcon(text));
      }
    }
    return { title, bullets, icons, presenterNote: presenterNote.trim() };
  });
}
