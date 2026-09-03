// Typed access to the web application's API routes (`/api/*`). Same JWT and tenant
// header as the mobile API; these are the endpoints the React web app already uses,
// so the screens below stay in lockstep with the web without new backend work.
import { mobileApi, webApi } from './runtime';

export type NotificationItem = Readonly<{
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}>;

export type AssignmentEnrollment = Readonly<{
  id: string;
  moduleId: string;
  status: string;
  progressPct: number;
  dueAt: string | null;
  hasPendingQuiz: boolean;
  module: {
    id: string;
    title: string;
    description: string | null;
    estimatedMinutes: number;
    category: { id: string; name: string; color: string | null; icon: string | null } | null;
    quizzes: Array<{ id: string; title: string; passingScore: number; timeLimit: number | null; passed: boolean }>;
  };
}>;

export type AssignmentsPayload = Readonly<{
  overdue: AssignmentEnrollment[];
  today: AssignmentEnrollment[];
  upcoming: AssignmentEnrollment[];
  noDueDate: AssignmentEnrollment[];
}>;

export type CareerPathDetail = Readonly<{
  id: string;
  title: string;
  description: string | null;
  targetRole?: string | null;
  estimatedWeeks?: number | null;
  userEnrollment: { status: string; progressPct: number; startedAt: string | null } | null;
  prerequisites: Array<{ prerequisite: { id: string; title: string } }>;
  modules: Array<{
    id: string;
    moduleId: string;
    order: number;
    isRequired: boolean;
    module: { id: string; title: string; description: string | null; estimatedMinutes: number; _count: { contents: number } };
    userStatus: { moduleId: string; status: string; progressPct: number } | null;
  }>;
}>;

export type CareerPathSummary = Readonly<{
  id: string;
  title: string;
  description: string | null;
  targetRole: string | null;
  estimatedWeeks: number | null;
  status: string;
  _count: { modules: number; enrollments: number };
  userEnrollment: { status: string; progressPct: number } | null;
}>;

export type BadgeItem = Readonly<{
  id: string;
  name: string;
  description: string;
  icon: string;
  type: string;
  points: number;
}>;

export type MyPathEnrollment = Readonly<{
  id: string;
  pathId: string;
  status: string;
  progressPct: number;
  path: { id: string; title: string; description: string | null; _count: { modules: number } };
}>;

export type DepartmentFlat = Readonly<{
  id: string;
  name: string;
  parentId: string | null;
  icon: string | null;
  color: string | null;
  managerName: string | null;
  mission: string | null;
  order: number;
  _count: { users: number; modules: number; children: number };
}>;

export type DepartmentMember = Readonly<{
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
  totalPoints: number;
  currentStreak: number;
}>;

export type PricingCategory = Readonly<{
  id: string;
  brand: string;
  name: string;
  sheetName: string | null;
  items: Array<{
    id: string;
    serviceName: string;
    description: string | null;
    price: string;
    currency: string;
    unit: string | null;
    features: string[];
  }>;
}>;

export type PricingPayload = Readonly<{
  categories: PricingCategory[];
  brands: Array<{ brand: string; label: string; categoryCount: number }>;
}>;

export type PricingAlert = Readonly<{
  id: string;
  brand: string;
  summary: string;
  createdAt: string;
  upload: { fileName: string; changeCount: number; createdAt: string; uploadedBy: { firstName: string; lastName: string } | null } | null;
}>;

export type MyStats = Readonly<{
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  rank: number;
  badges: Array<{ id: string; earnedAt: string; badge: { id: string; name: string; description: string; icon: string; points: number } }>;
}>;

export type SearchPayload = Readonly<{
  modules: Array<{ id: string; title: string; description: string | null }>;
  articles: Array<{ id: string; slug?: string; title: string; excerpt?: string | null }>;
  departments: Array<{ id: string; name: string }>;
  paths: Array<{ id: string; title: string }>;
}>;

export const web = {
  notifications: () => webApi.request<NotificationItem[]>('/notifications'),
  markNotificationRead: (id: string) => webApi.request<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => webApi.request<{ ok: boolean }>('/notifications/read-all', { method: 'PATCH' }),

  assignments: () => webApi.request<AssignmentsPayload>('/assignments'),

  paths: () => webApi.request<CareerPathSummary[]>('/career/paths'),
  badges: () => webApi.request<BadgeItem[]>('/gamification/badges'),
  careerPath: (id: string) => webApi.request<CareerPathDetail>(`/career/paths/${id}`),
  myPaths: () => webApi.request<MyPathEnrollment[]>('/career/my-paths'),
  enrollPath: (id: string) => webApi.request<{ id: string }>(`/career/paths/${id}/enroll`, { method: 'POST' }),

  departments: () => webApi.request<DepartmentFlat[]>('/departments?flat=true'),
  departmentMembers: (id: string) => webApi.request<DepartmentMember[]>(`/departments/${id}/members`),

  pricing: (brand?: string) => webApi.request<PricingPayload>(brand ? `/pricing?brand=${encodeURIComponent(brand)}` : '/pricing'),
  pricingAlerts: () => webApi.request<{ alerts: PricingAlert[] }>('/pricing/alerts'),

  myStats: () => webApi.request<MyStats>('/gamification/my-stats'),
  changePassword: (currentPassword: string, newPassword: string) =>
    webApi.request<{ message?: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  search: (q: string) => webApi.request<SearchPayload>(`/search?q=${encodeURIComponent(q)}`),

  /** Short-lived token that authorizes /uploads media (video, audio, PDF, certificates) as `?t=`. */
  mediaToken: () => mobileApi.request<{ token: string; expiresInSeconds: number }>('/media-token'),
};
