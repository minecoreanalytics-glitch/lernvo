// Pure message catalogue: no native imports so it can run in vitest.
// French and English ship together from the first pilot (design spec §12).

export type Locale = 'fr' | 'en';

const en = {
  'common.tryAgain': 'Try again',
  'common.somethingWrong': 'Something went wrong',
  'common.network': 'No connection. Check your network and try again.',
  'common.sessionExpired': 'Your session expired. Sign in again.',
  'common.minutes': '{count} min',

  'signIn.intro': 'A few focused minutes, built for your work.',
  'signIn.company': 'Company',
  'signIn.companyPlaceholder': 'company-name',
  'signIn.email': 'Email',
  'signIn.password': 'Password',
  'signIn.selectCompany': 'Select your company',
  'signIn.continue': 'Continue',

  'tabs.today': 'Home',
  'tabs.learn': 'Learn',
  'tabs.docs': 'Docs',
  'tabs.ask': 'Ask',
  'tabs.inbox': 'Inbox',
  'tabs.me': 'Me',
  'tabs.a11y': '{tab} tab',

  'sync.syncing': 'Syncing',
  'sync.offline': 'Offline',
  'sync.attention': 'Sync needs attention',
  'sync.upToDate': 'Up to date',
  'sync.a11y': 'Synchronize learning',

  'today.eyebrow': 'Your daily focus',
  'today.greeting': 'Good day, {name}',
  'today.fallbackName': 'there',
  'today.reason.overdue': 'Overdue',
  'today.reason.dueToday': 'Due today',
  'today.reason.inProgress': 'In progress',
  'today.reason.assigned': 'Assigned to you',
  'today.caughtUp': 'Caught up',
  'today.noSessionTitle': 'No assigned session right now',
  'today.noSessionBody': 'When your company assigns a module or quiz, it will show up here.',
  'today.quizBody': 'Finish with a short knowledge check. Scoring happens on the server.',
  'today.moduleBody': 'A short session to keep your assigned learning moving.',
  'today.start': 'Start today’s session',
  'today.openTeam': 'Open Team workspace',

  'learn.eyebrow': 'Your work',
  'learn.title': 'Learn',
  'learn.empty': 'No modules are assigned yet. Check back after your next plan update.',
  'learn.status.ASSIGNED': 'Assigned',
  'learn.status.IN_PROGRESS': 'In progress',
  'learn.status.COMPLETED': 'Completed',
  'learn.status.OVERDUE': 'Overdue',
  'learn.segmentModules': 'Modules',
  'learn.segmentDocs': 'Documents',
  'learn.path': 'Path',
  'learn.moduleCount': '{count} modules',

  'docs.eyebrow': 'Reference',
  'docs.title': 'Documents',
  'docs.empty': 'No documents yet. Approved procedures and guides from your company will appear here.',
  'docs.updated': 'Updated {date}',
  'docs.document': 'Document',

  'ask.eyebrow': 'Knowledge assistant',
  'ask.title': 'Ask',
  'ask.copy': 'Ask a work question. Answers are grounded in your company’s approved knowledge.',
  'ask.placeholder': 'Ask about a process, policy, or assigned training',
  'ask.send': 'Send',
  'ask.sources': 'Sources: {list}',
  'ask.unreachable': 'Unable to reach the assistant',
  'ask.question': 'Question',

  'inbox.eyebrow': 'Updates',
  'inbox.title': 'Inbox',
  'inbox.empty': 'No announcements yet.',
  'inbox.unreadCount': '{count} unread',
  'inbox.unread': 'Unread',
  'inbox.acknowledge': 'Acknowledge',
  'inbox.acknowledged': 'Acknowledged',

  'me.eyebrow': 'Profile',
  'me.title': 'Me',
  'me.stats': '{points} pts · {streak}-day streak · {completed} completed',
  'me.certificate': 'Certificate',
  'me.noCertificates': 'Certificates you earn will appear here.',
  'me.signOut': 'Sign out',
  'me.language': 'Language follows your device settings.',

  'team.eyebrow': 'Manager workspace',
  'team.title': 'Team',
  'team.summary': '{count} people · {overdue} with overdue training',
  'team.member': '{overdue} overdue · {inProgress} in progress',
  'team.empty': 'No direct reports yet.',

  'module.title': 'Module',
  'module.prerequisite': 'Finish “{title}” before this module.',
  'module.done': 'Done',
  'module.markDone': 'Mark as done',
  'module.takeQuiz': 'Take quiz: {title}',

  'quiz.eyebrow': 'Knowledge check',
  'quiz.title': 'Quiz',
  'quiz.alreadyPassed': 'This quiz is already passed.',
  'quiz.question': 'Question {n}',
  'quiz.correct': 'Correct',
  'quiz.incorrect': 'Incorrect',
  'quiz.passed': 'Passed',
  'quiz.notPassed': 'Not passed yet',
  'quiz.score': 'Score {score}% · {points} pts',
  'quiz.submitting': 'Submitting…',
  'quiz.submit': 'Submit answers',
  'quiz.submitError': 'Unable to submit quiz',
} as const;

export type MessageKey = keyof typeof en;

const fr: Record<MessageKey, string> = {
  'common.tryAgain': 'Réessayer',
  'common.somethingWrong': 'Une erreur est survenue',
  'common.network': 'Pas de connexion. Vérifiez votre réseau et réessayez.',
  'common.sessionExpired': 'Votre session a expiré. Reconnectez-vous.',
  'common.minutes': '{count} min',

  'signIn.intro': 'Quelques minutes ciblées, pensées pour votre travail.',
  'signIn.company': 'Entreprise',
  'signIn.companyPlaceholder': 'nom-entreprise',
  'signIn.email': 'Courriel',
  'signIn.password': 'Mot de passe',
  'signIn.selectCompany': 'Choisissez votre entreprise',
  'signIn.continue': 'Continuer',

  'tabs.today': 'Accueil',
  'tabs.learn': 'Formations',
  'tabs.docs': 'Documents',
  'tabs.ask': 'Assistant',
  'tabs.inbox': 'Annonces',
  'tabs.me': 'Moi',
  'tabs.a11y': 'Onglet {tab}',

  'sync.syncing': 'Synchronisation',
  'sync.offline': 'Hors ligne',
  'sync.attention': 'Synchronisation à vérifier',
  'sync.upToDate': 'À jour',
  'sync.a11y': 'Synchroniser la formation',

  'today.eyebrow': 'Votre priorité du jour',
  'today.greeting': 'Bonjour, {name}',
  'today.fallbackName': 'à vous',
  'today.reason.overdue': 'En retard',
  'today.reason.dueToday': 'À faire aujourd’hui',
  'today.reason.inProgress': 'En cours',
  'today.reason.assigned': 'Assigné',
  'today.caughtUp': 'À jour',
  'today.noSessionTitle': 'Aucune session assignée pour le moment',
  'today.noSessionBody': 'Dès que votre entreprise vous assigne un module ou un quiz, il apparaîtra ici.',
  'today.quizBody': 'Terminez par une courte vérification des connaissances. La correction se fait côté serveur.',
  'today.moduleBody': 'Une courte session pour faire avancer votre formation.',
  'today.start': 'Commencer la session du jour',
  'today.openTeam': 'Ouvrir l’espace Équipe',

  'learn.eyebrow': 'Votre travail',
  'learn.title': 'Formations',
  'learn.empty': 'Aucun module assigné pour l’instant. Revenez après la prochaine mise à jour de votre plan.',
  'learn.status.ASSIGNED': 'Assigné',
  'learn.status.IN_PROGRESS': 'En cours',
  'learn.status.COMPLETED': 'Terminé',
  'learn.status.OVERDUE': 'En retard',
  'learn.segmentModules': 'Formations',
  'learn.segmentDocs': 'Documents',
  'learn.path': 'Parcours',
  'learn.moduleCount': '{count} modules',

  'docs.eyebrow': 'Référence',
  'docs.title': 'Documents',
  'docs.empty': 'Aucun document pour l’instant. Les procédures et guides approuvés par votre entreprise apparaîtront ici.',
  'docs.updated': 'Mis à jour le {date}',
  'docs.document': 'Document',

  'ask.eyebrow': 'Assistant de connaissance',
  'ask.title': 'Assistant',
  'ask.copy': 'Posez une question de travail. Les réponses s’appuient sur les connaissances approuvées de votre entreprise.',
  'ask.placeholder': 'Une procédure, une politique, une formation assignée…',
  'ask.send': 'Envoyer',
  'ask.sources': 'Sources : {list}',
  'ask.unreachable': 'Impossible de joindre l’assistant',
  'ask.question': 'Question',

  'inbox.eyebrow': 'Actualités',
  'inbox.title': 'Annonces',
  'inbox.empty': 'Aucune annonce pour l’instant.',
  'inbox.unreadCount': '{count} non lue(s)',
  'inbox.unread': 'Non lue',
  'inbox.acknowledge': 'J’ai lu',
  'inbox.acknowledged': 'Lue',

  'me.eyebrow': 'Profil',
  'me.title': 'Moi',
  'me.stats': '{points} pts · série de {streak} jours · {completed} terminés',
  'me.certificate': 'Certificat',
  'me.noCertificates': 'Vos certificats apparaîtront ici.',
  'me.signOut': 'Se déconnecter',
  'me.language': 'La langue suit les réglages de votre appareil.',

  'team.eyebrow': 'Espace gestionnaire',
  'team.title': 'Équipe',
  'team.summary': '{count} personnes · {overdue} avec des formations en retard',
  'team.member': '{overdue} en retard · {inProgress} en cours',
  'team.empty': 'Aucun collaborateur direct pour l’instant.',

  'module.title': 'Module',
  'module.prerequisite': 'Terminez « {title} » avant ce module.',
  'module.done': 'Terminé',
  'module.markDone': 'Marquer comme terminé',
  'module.takeQuiz': 'Passer le quiz : {title}',

  'quiz.eyebrow': 'Vérification des connaissances',
  'quiz.title': 'Quiz',
  'quiz.alreadyPassed': 'Ce quiz est déjà réussi.',
  'quiz.question': 'Question {n}',
  'quiz.correct': 'Correct',
  'quiz.incorrect': 'Incorrect',
  'quiz.passed': 'Réussi',
  'quiz.notPassed': 'Pas encore réussi',
  'quiz.score': 'Score {score} % · {points} pts',
  'quiz.submitting': 'Envoi…',
  'quiz.submit': 'Envoyer mes réponses',
  'quiz.submitError': 'Impossible d’envoyer le quiz',
};

export const messages: Record<Locale, Record<MessageKey, string>> = { en, fr };

export function resolveLocale(languageCode: string | null | undefined): Locale {
  return languageCode?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars: Record<string, string | number> = {},
): string {
  const template = messages[locale][key] ?? messages.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}
