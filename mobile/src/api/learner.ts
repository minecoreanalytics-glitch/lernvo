import { mobileApi } from './runtime';

export type TodaySession =
  | { kind: 'none' }
  | {
      kind: 'module' | 'quiz';
      moduleId: string;
      quizId: string | null;
      title: string;
      dueAt: string | null;
      estimatedMinutes: number;
      reason: 'overdue' | 'dueToday' | 'inProgress' | 'assigned';
      progressPct: number;
    };

export type LearnModule = Readonly<{
  id: string;
  title: string;
  description: string | null;
  estimatedMinutes: number;
  category: { id: string; name: string; color: string | null } | null;
  status: string;
  progressPct: number;
  dueAt: string | null;
  quizzes: Array<{ id: string; title: string }>;
}>;

export type LearnPath = Readonly<{
  id: string;
  title: string;
  description: string | null;
  status: string;
  progressPct: number;
  moduleCount: number;
}>;

export type ModuleDetail = Readonly<{
  id: string;
  title: string;
  description: string | null;
  estimatedMinutes: number;
  category: { id: string; name: string; color: string | null } | null;
  prerequisite: { id: string; title: string } | null;
  prerequisiteMet: boolean;
  enrollment: {
    id: string;
    status: string;
    progressPct: number;
    dueAt: string | null;
    startedAt: string | null;
  } | null;
  contents: Array<{
    id: string;
    title: string;
    type: string;
    url: string | null;
    body: string | null;
    duration: number | null;
    order: number;
    isRequired: boolean;
    progress: { contentId: string; progressPct: number; completed: boolean } | null;
  }>;
  quizzes: Array<{
    id: string;
    title: string;
    passingScore: number;
    timeLimit: number | null;
  }>;
}>;

export type QuizDetail = Readonly<{
  id: string;
  moduleId: string | null;
  title: string;
  description: string | null;
  timeLimit: number | null;
  passingScore: number;
  maxAttempts: number;
  userAttemptCount: number;
  canAttempt: boolean;
  questions: Array<{
    id: string;
    text: string;
    imageUrl: string | null;
    points: number;
    order: number;
    options: Array<{ id: string; text: string }>;
  }>;
}>;

export type QuizSubmitResult = Readonly<{
  attemptId: string;
  score: number;
  passed: boolean;
  pointsEarned: number;
  answers: Array<{
    questionId: string;
    selectedOptionId: string;
    isCorrect: boolean;
    pointsEarned: number;
    explanation: string | null;
  }>;
}>;

export type AnnouncementItem = Readonly<{
  id: string;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
  company: { id: string; name: string; slug: string };
  author: { firstName: string; lastName: string };
  isUnread: boolean;
}>;

export type ProfilePayload = Readonly<{
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl: string | null;
    totalPoints: number;
    currentStreak: number;
    department: { id: string; name: string } | null;
  };
  progress: { assigned: number; inProgress: number; completed: number };
  certificates: Array<{
    id: string;
    title: string;
    certNumber: string;
    issuedAt: string;
    expiresAt: string | null;
    score: number | null;
    moduleTitle: string | null;
    pathTitle: string | null;
  }>;
}>;

export type TeamPayload = Readonly<{
  count: number;
  overdueMembers: number;
  members: Array<{
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    department: string | null;
    currentStreak: number;
    lastLoginAt: string | null;
    overdueCount: number;
    inProgressCount: number;
  }>;
}>;

export type BootstrapPayload = Readonly<{
  currentUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    role: string;
    departmentId: string | null;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string | null;
    supportEmail: string | null;
  };
  capabilities: string[];
  featureFlags: Record<string, boolean>;
}>;

export type KbArticleSummary = Readonly<{
  id: string;
  title: string;
  category: string | null;
  tags: string[];
  updatedAt: string;
}>;

export type KbArticleDetail = Readonly<{
  id: string;
  title: string;
  body: string;
  category: string | null;
  tags: string[];
  updatedAt: string;
}>;

export type LeaderboardPayload = Readonly<{
  scope: 'company' | 'department';
  me: { rank: number | null; totalPoints: number; currentStreak: number } | null;
  entries: Array<{
    rank: number;
    userId: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    totalPoints: number;
    currentStreak: number;
    department: string | null;
    isMe: boolean;
  }>;
}>;

export const learnerApi = {
  bootstrap: () => mobileApi.request<BootstrapPayload>('/bootstrap'),
  today: () => mobileApi.request<{ session: TodaySession }>('/today'),
  learn: () => mobileApi.request<{ modules: LearnModule[]; paths: LearnPath[] }>('/learn'),
  kb: () => mobileApi.request<{ articles: KbArticleSummary[] }>('/kb'),
  kbArticle: (id: string) => mobileApi.request<KbArticleDetail>(`/kb/${id}`),
  module: (id: string) => mobileApi.request<ModuleDetail>(`/modules/${id}`),
  startModule: (id: string) => mobileApi.request<{ enrollment: { id: string; status: string } }>(`/modules/${id}/start`, { method: 'POST' }),
  markContent: (id: string, progressPct: number) =>
    mobileApi.request<{ progress: { completed: boolean; progressPct: number } }>(`/contents/${id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ progressPct }),
    }),
  quiz: (id: string) => mobileApi.request<QuizDetail>(`/quizzes/${id}`),
  submitQuiz: (id: string, answers: Array<{ questionId: string; selectedOptionId: string }>, timeTaken?: number) =>
    mobileApi.request<QuizSubmitResult>(`/quizzes/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers, timeTaken }),
    }),
  ask: (message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) =>
    mobileApi.request<{ reply: string; citations: Array<{ id: string; title: string }> }>('/ask', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    }),
  inbox: () => mobileApi.request<{ unreadCount: number; announcements: AnnouncementItem[] }>('/inbox'),
  acknowledge: (ids: string[]) =>
    mobileApi.request<{ marked: number; unreadCount: number }>('/inbox/read', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  me: () => mobileApi.request<ProfilePayload>('/me'),
  team: () => mobileApi.request<TeamPayload>('/team'),
  leaderboard: () => mobileApi.request<LeaderboardPayload>('/leaderboard'),
};
