import type { LucideIcon } from 'lucide-react'
import {
  Rocket, Store, Users, Repeat, GraduationCap, MessageSquareText, ListChecks,
  UserPlus, BadgeCheck, FileCheck2, Gauge, Award, BarChart3, GitBranch,
  BookOpenCheck, Bell, Sparkles, ShieldCheck, Clock,
} from 'lucide-react'

export type Lang = 'fr' | 'en'
export type Point = [LucideIcon, string, string]
export interface SolutionCopy {
  kicker: string
  title: string
  promise: string
  problem: string
  points: Point[]
  close: string
}
export interface Solution {
  kind: 'outcome' | 'capability'
  slug: string
  icon: LucideIcon
  base: string // route base, e.g. /solutions or /platform/capabilities
  fr: SolutionCopy
  en: SolutionCopy
}

export const SOLUTIONS: Solution[] = [
  /* ── OUTCOMES ────────────────────────────────────────── */
  {
    kind: 'outcome', slug: 'onboarding', icon: Rocket, base: '/solutions',
    fr: {
      kicker: 'Résultat', title: 'Accélérer l’intégration',
      promise: 'Vos nouveaux deviennent productifs en quelques jours, pas en trois semaines.',
      problem: 'Un onboarding lent coûte cher : erreurs, tickets répétés, managers qui réexpliquent la même chose.',
      points: [
        [UserPlus, 'Un parcours dès le premier jour', 'Le bon parcours est affecté automatiquement. Le nouvel employé sait quoi lire, et dans quel ordre.'],
        [MessageSquareText, 'Un assistant qui répond', 'Il pose sa question, il obtient la réponse approuvée en secondes. Le manager n’est plus le seul recours.'],
        [BadgeCheck, 'La preuve que c’est acquis', 'Quiz de section et « lu et compris » : vous voyez qui est prêt, pas seulement qui a assisté.'],
      ],
      close: 'Le premier jour devient un jour productif.',
    },
    en: {
      kicker: 'Outcome', title: 'Faster onboarding',
      promise: 'New hires get productive in days, not three weeks.',
      problem: 'Slow onboarding is expensive: mistakes, repeat tickets, managers re-explaining the same thing.',
      points: [
        [UserPlus, 'A path from day one', 'The right learning path is assigned automatically. New hires know what to read, and in what order.'],
        [MessageSquareText, 'An assistant that answers', 'They ask, they get the approved answer in seconds. The manager is no longer the only option.'],
        [BadgeCheck, 'Proof it landed', 'Section quizzes and read-and-acknowledge show who is ready, not just who showed up.'],
      ],
      close: 'Day one becomes a productive day.',
    },
  },
  {
    kind: 'outcome', slug: 'customer-experience', icon: Store, base: '/solutions',
    fr: {
      kicker: 'Résultat', title: 'Une expérience client cohérente',
      promise: 'La même promesse à chaque point de vente, à chaque quart de travail.',
      problem: 'Quand chaque agent répond à sa façon, le client le sent, et la marque en paie le prix.',
      points: [
        [FileCheck2, 'Produits et prix à jour', 'Vos équipes voient la version approuvée, jamais un vieux PDF. Le bon prix, la bonne offre.'],
        [MessageSquareText, 'La bonne réponse devant le client', 'L’assistant donne la réponse sourcée pendant l’échange, pas une heure après.'],
        [Gauge, 'Repérer les écarts tôt', 'La couverture par équipe montre où la procédure n’est pas connue, avant que le client le découvre.'],
      ],
      close: 'Un client qui reçoit la même réponse partout revient.',
    },
    en: {
      kicker: 'Outcome', title: 'A consistent customer experience',
      promise: 'The same promise at every location, on every shift.',
      problem: 'When every agent answers differently, the customer feels it, and the brand pays for it.',
      points: [
        [FileCheck2, 'Current products and prices', 'Teams see the approved version, never an old PDF. The right price, the right offer.'],
        [MessageSquareText, 'The right answer in front of the customer', 'The assistant gives the sourced answer during the conversation, not an hour later.'],
        [Gauge, 'Catch the gaps early', 'Per-team coverage shows where a procedure is not known, before the customer finds out.'],
      ],
      close: 'A customer who gets the same answer everywhere comes back.',
    },
  },
  {
    kind: 'outcome', slug: 'employee-engagement', icon: Users, base: '/solutions',
    fr: {
      kicker: 'Résultat', title: 'Engagement et rétention',
      promise: 'On garde les bonnes personnes en leur donnant la maîtrise de leur métier.',
      problem: 'Un employé qui ne sait pas où trouver l’information se sent perdu, et il finit par partir.',
      points: [
        [Award, 'Parcours et reconnaissance', 'Parcours carrière, badges, classements : la progression est visible et valorisée.'],
        [MessageSquareText, 'L’information tout de suite', 'Ce dont ils ont besoin pour bien faire leur travail est à portée, sans avoir à chercher.'],
        [BarChart3, 'La RH voit la progression', 'Chaque acquis est tracé. Les entretiens s’appuient sur des faits, pas des impressions.'],
      ],
      close: 'Des équipes qui maîtrisent leur métier restent plus longtemps.',
    },
    en: {
      kicker: 'Outcome', title: 'Engagement and retention',
      promise: 'You keep the right people by giving them mastery of their job.',
      problem: 'An employee who cannot find the answer feels lost, and eventually leaves.',
      points: [
        [Award, 'Paths and recognition', 'Career paths, badges, leaderboards: progress is visible and rewarded.'],
        [MessageSquareText, 'Answers, right away', 'What they need to do the job well is within reach, no digging.'],
        [BarChart3, 'HR sees the progress', 'Every skill is traced. Reviews rest on facts, not impressions.'],
      ],
      close: 'Teams that master their work stay longer.',
    },
  },
  {
    kind: 'outcome', slug: 'change-management', icon: Repeat, base: '/solutions',
    fr: {
      kicker: 'Résultat', title: 'Prêt au changement',
      promise: 'Déployez une nouvelle règle, et prouvez qu’elle a été comprise.',
      problem: 'Un changement envoyé par e-mail n’est ni lu, ni compris, ni prouvé.',
      points: [
        [GitBranch, 'La nouvelle version, poussée à tous', 'Vous approuvez la version suivante : tout le monde reçoit « à lire et valider », l’ancienne disparaît.'],
        [BookOpenCheck, 'Une trace par personne', 'Vous savez qui a validé, quand, et sur quelle version exactement.'],
        [Bell, 'Les signaux montrent où ça bloque', 'Là où la couverture reste basse, vous relancez avant que ça coûte.'],
      ],
      close: 'Un changement n’est pas fini quand il est envoyé. Il l’est quand il est prouvé.',
    },
    en: {
      kicker: 'Outcome', title: 'Change readiness',
      promise: 'Roll out a new rule, and prove it was understood.',
      problem: 'A change sent by email is not read, not understood, not proven.',
      points: [
        [GitBranch, 'The new version, pushed to everyone', 'You approve the next version: everyone gets read-and-acknowledge, the old one disappears.'],
        [BookOpenCheck, 'A trace per person', 'You know who acknowledged, when, and on which version exactly.'],
        [Bell, 'Signals show where it stalls', 'Where coverage stays low, you follow up before it costs you.'],
      ],
      close: 'A change is not done when it is sent. It is done when it is proven.',
    },
  },
  /* ── CAPABILITIES ────────────────────────────────────── */
  {
    kind: 'capability', slug: 'training', icon: GraduationCap, base: '/platform/capabilities',
    fr: {
      kicker: 'Capacité', title: 'Formation et renforcement',
      promise: 'Des modules tirés de vos propres documents, retenus dans la durée.',
      problem: 'Écrire une formation à la main prend des semaines. La plupart ne sont jamais faites.',
      points: [
        [Sparkles, 'Généré depuis vos PDF', 'Importez un document, l’IA en tire un module et son quiz. Vous relisez, vous approuvez.'],
        [BookOpenCheck, 'Quiz et parcours', 'Quiz de section avec score, parcours carrière ordonnés, certificats vérifiables.'],
        [Award, 'Gamification', 'Points, badges, classements : la régularité devient un réflexe.'],
      ],
      close: 'Vos procédures deviennent de la formation, sans repartir de zéro.',
    },
    en: {
      kicker: 'Capability', title: 'Training and reinforcement',
      promise: 'Modules drawn from your own documents, retained over time.',
      problem: 'Writing training by hand takes weeks. Most of it never gets made.',
      points: [
        [Sparkles, 'Generated from your PDFs', 'Import a document, the AI turns it into a module and its quiz. You review, you approve.'],
        [BookOpenCheck, 'Quizzes and paths', 'Scored section quizzes, ordered career paths, verifiable certificates.'],
        [Award, 'Gamification', 'Points, badges, leaderboards: consistency becomes a habit.'],
      ],
      close: 'Your procedures become training, without starting from scratch.',
    },
  },
  {
    kind: 'capability', slug: 'ai-assistant', icon: MessageSquareText, base: '/platform/capabilities',
    fr: {
      kicker: 'Capacité', title: 'Assistant IA',
      promise: 'La bonne réponse en secondes, uniquement depuis l’approuvé.',
      problem: 'Un chatbot qui invente est pire que pas de chatbot. Le vôtre ne peut pas.',
      points: [
        [ShieldCheck, 'Ancré dans l’approuvé', 'Chaque réponse vient de vos documents validés. Jamais le web, jamais une supposition.'],
        [FileCheck2, 'Cité à la version', '« source : Procédure v3 » sous chaque réponse. Vous savez d’où ça vient.'],
        [Bell, 'Le vide devient un signal', 'Quand il ne trouve pas, il le dit, et signale le document manquant.'],
      ],
      close: 'Un assistant en qui vos équipes peuvent réellement avoir confiance.',
    },
    en: {
      kicker: 'Capability', title: 'AI assistant',
      promise: 'The right answer in seconds, only from approved knowledge.',
      problem: 'A chatbot that invents is worse than none. Yours cannot.',
      points: [
        [ShieldCheck, 'Grounded in approved knowledge', 'Every answer comes from your approved documents. Never the web, never a guess.'],
        [FileCheck2, 'Cited to the version', '“source: Procedure v3” under every answer. You know where it came from.'],
        [Bell, 'Gaps become signals', 'When it cannot find it, it says so, and flags the missing document.'],
      ],
      close: 'An assistant your teams can actually trust.',
    },
  },
  {
    kind: 'capability', slug: 'assignments', icon: ListChecks, base: '/platform/capabilities',
    fr: {
      kicker: 'Capacité', title: 'Tâches et affectations',
      promise: 'Assignez une procédure, fixez une échéance, suivez qui l’a validée.',
      problem: 'Envoyer un document ne garantit rien. Une affectation avec échéance, si.',
      points: [
        [ListChecks, 'Affecter à la bonne personne', 'Par employé ou par département, avec une date limite claire.'],
        [Clock, 'En retard, aujourd’hui, à venir', 'Chacun voit ses échéances, le manager voit les retards, sans relancer à la main.'],
        [BadgeCheck, '« Lu et compris » obligatoire', 'La validation est tracée. Vous ne demandez plus si c’est fait, vous le voyez.'],
      ],
      close: 'Rien ne se perd entre l’envoi et l’exécution.',
    },
    en: {
      kicker: 'Capability', title: 'Tasks and assignments',
      promise: 'Assign a procedure, set a deadline, track who acknowledged it.',
      problem: 'Sending a document guarantees nothing. An assignment with a deadline does.',
      points: [
        [ListChecks, 'Assign to the right person', 'By employee or by department, with a clear due date.'],
        [Clock, 'Overdue, today, upcoming', 'Everyone sees their deadlines, the manager sees what is late, no manual chasing.'],
        [BadgeCheck, 'Read-and-acknowledge required', 'The acknowledgment is traced. You stop asking if it is done, you see it.'],
      ],
      close: 'Nothing gets lost between sending and doing.',
    },
  },
]

export function getSolution(slug: string | undefined): Solution | undefined {
  return SOLUTIONS.find(s => s.slug === slug)
}

export const OUTCOMES = SOLUTIONS.filter(s => s.kind === 'outcome')
export const CAPABILITIES = SOLUTIONS.filter(s => s.kind === 'capability')

export interface ProductLink { label: string; href: string; desc: string }
export const PRODUCTS: Record<Lang, ProductLink[]> = {
  fr: [
    { label: 'Vue d’ensemble', href: '/platform', desc: 'La plateforme en un coup d’œil' },
    { label: 'Intégrations', href: '/platform#integrations', desc: 'Odoo, CSV, API, IA' },
    { label: 'Tarifs', href: '/#pricing', desc: 'Par employé actif' },
  ],
  en: [
    { label: 'Overview', href: '/platform', desc: 'The platform at a glance' },
    { label: 'Integrations', href: '/platform#integrations', desc: 'Odoo, CSV, API, AI' },
    { label: 'Pricing', href: '/#pricing', desc: 'Per active employee' },
  ],
}

export const MENU_LABELS: Record<Lang, { products: string; outcomes: string; capabilities: string }> = {
  fr: { products: 'Produits', outcomes: 'Résultats', capabilities: 'Capacités' },
  en: { products: 'Products', outcomes: 'Outcomes', capabilities: 'Capabilities' },
}

/* Extra richer content per solution: the cost of today, and what you get. */
export interface Extra { cost: string[]; youGet: string[] }
export const EXTRA: Record<string, Record<Lang, Extra>> = {
  onboarding: {
    fr: {
      cost: ['Trois semaines avant qu’un nouveau soit vraiment utile.', 'Le manager passe ses journées à répéter les mêmes réponses.', 'Les premières erreurs partent chez le client.'],
      youGet: ['Un parcours d’intégration par poste, prêt le jour 1.', 'Un assistant qui répond aux questions courantes.', 'La liste des acquis validés, par personne.', 'Le premier certificat dès la première semaine.'],
    },
    en: {
      cost: ['Three weeks before a new hire is truly useful.', 'The manager spends the day repeating the same answers.', 'The first mistakes reach the customer.'],
      youGet: ['An onboarding path per role, ready on day one.', 'An assistant that handles the common questions.', 'A list of acknowledged skills, per person.', 'The first certificate within the first week.'],
    },
  },
  'customer-experience': {
    fr: {
      cost: ['Le même produit expliqué de trois façons différentes.', 'Un prix erroné annoncé, puis à corriger devant le client.', 'La marque qui se dilue à chaque point de vente.'],
      youGet: ['Les produits et prix approuvés, visibles partout.', 'Un assistant qui donne la réponse pendant l’échange.', 'La couverture par équipe, pour voir les écarts.', 'La preuve que la dernière version est connue.'],
    },
    en: {
      cost: ['The same product explained three different ways.', 'A wrong price quoted, then corrected in front of the customer.', 'A brand that dilutes at every location.'],
      youGet: ['Approved products and prices, visible everywhere.', 'An assistant that answers during the conversation.', 'Per-team coverage, to see the gaps.', 'Proof the latest version is known.'],
    },
  },
  'employee-engagement': {
    fr: {
      cost: ['Un employé qui cherche l’info et ne la trouve pas.', 'Aucune visibilité sur qui progresse, ni comment.', 'Les meilleurs partent, faute de perspective.'],
      youGet: ['Des parcours carrière clairs, avec badges.', 'L’information utile à portée de main.', 'Un classement qui valorise la régularité.', 'Une preuve de progression pour les entretiens RH.'],
    },
    en: {
      cost: ['An employee who looks for the answer and does not find it.', 'No visibility into who is progressing, or how.', 'The best people leave, for lack of a path.'],
      youGet: ['Clear career paths, with badges.', 'Useful information within reach.', 'A leaderboard that rewards consistency.', 'Proof of progress for HR reviews.'],
    },
  },
  'change-management': {
    fr: {
      cost: ['Une nouvelle règle envoyée, jamais confirmée.', 'Des équipes qui appliquent encore l’ancienne version.', 'Un audit sans aucune preuve à montrer.'],
      youGet: ['La version approuvée poussée à tous en un clic.', 'Une trace horodatée par personne et par version.', 'Des signaux là où le changement n’a pas pris.', 'Un dossier de preuve prêt pour l’audit.'],
    },
    en: {
      cost: ['A new rule sent, never confirmed.', 'Teams still applying the old version.', 'An audit with no evidence to show.'],
      youGet: ['The approved version pushed to everyone in one click.', 'A timestamped trace per person and per version.', 'Signals where the change did not land.', 'An evidence trail ready for audit.'],
    },
  },
  training: {
    fr: {
      cost: ['Écrire un module à la main prend des jours.', 'Les procédures dorment en PDF, jamais transformées.', 'Personne ne sait ce qui a été retenu.'],
      youGet: ['Un module et son quiz générés depuis un PDF.', 'Des parcours ordonnés et des certificats vérifiables.', 'Points, badges et classements intégrés.', 'Le score de rétention, par section.'],
    },
    en: {
      cost: ['Writing a module by hand takes days.', 'Procedures sit in PDFs, never turned into training.', 'Nobody knows what was retained.'],
      youGet: ['A module and its quiz generated from a PDF.', 'Ordered paths and verifiable certificates.', 'Points, badges and leaderboards built in.', 'The retention score, per section.'],
    },
  },
  'ai-assistant': {
    fr: {
      cost: ['Un chatbot générique qui invente des réponses.', 'Des heures perdues à chercher dans dix systèmes.', 'Aucune façon de savoir d’où vient une réponse.'],
      youGet: ['Des réponses tirées uniquement de l’approuvé.', 'La source et la version citées à chaque fois.', 'Un signal quand un document manque.', 'Un historique des questions posées, par équipe.'],
    },
    en: {
      cost: ['A generic chatbot that invents answers.', 'Hours lost searching across ten systems.', 'No way to know where an answer came from.'],
      youGet: ['Answers drawn only from approved content.', 'The source and version cited every time.', 'A signal when a document is missing.', 'A log of the questions asked, per team.'],
    },
  },
  assignments: {
    fr: {
      cost: ['Un document envoyé, jamais ouvert.', 'Le manager qui relance à la main, un par un.', 'Aucune preuve que la consigne a été vue.'],
      youGet: ['L’affectation par personne ou par département.', 'Des vues en retard, aujourd’hui, à venir.', 'La validation « lu et compris » tracée.', 'Un tableau de bord de couverture en direct.'],
    },
    en: {
      cost: ['A document sent, never opened.', 'The manager chasing by hand, one by one.', 'No proof the instruction was seen.'],
      youGet: ['Assignment per person or per department.', 'Overdue, today, upcoming views.', 'Traced read-and-acknowledge.', 'A live coverage dashboard.'],
    },
  },
}

export const PROOF: Record<Lang, { items: string[]; note: string }> = {
  fr: { items: ['100+ employés en production', '394 procédures & produits', '3 344 questions de quiz', '39 départements'], note: 'Premier déploiement : un groupe multi-filiales de 100+ employés.' },
  en: { items: ['100+ employees in production', '394 procedures & products', '3,344 quiz questions', '39 departments'], note: 'First deployment: a 100+ employee multi-brand group.' },
}

/* Per-page signature accent (distinct hue per topic; navy stays the brand base). */
export const ACCENT: Record<string, { c: string; soft: string }> = {
  'onboarding':           { c: '#0EA968', soft: '#E7F6EF' },
  'customer-experience':  { c: '#E0880C', soft: '#FBF0DB' },
  'employee-engagement':  { c: '#6D4AE0', soft: '#ECE8FB' },
  'change-management':    { c: '#0E97B0', soft: '#DDF2F5' },
  'training':             { c: '#2B59D8', soft: '#E3E9FB' },
  'ai-assistant':         { c: '#3B4CC4', soft: '#E5E8FA' },
  'assignments':          { c: '#DB4F66', soft: '#FBE6E9' },
}

/* Big-number stats for the color-block band (real production facts). */
export const STATS: Record<Lang, [string, string][]> = {
  fr: [['100+', 'employés en production'], ['394', 'procédures & produits'], ['3 344', 'questions de quiz'], ['39', 'départements']],
  en: [['100+', 'employees in production'], ['394', 'procedures & products'], ['3,344', 'quiz questions'], ['39', 'departments']],
}
