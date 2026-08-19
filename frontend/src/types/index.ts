export type Role = 'SUPER_ADMIN' | 'PLATFORM_MANAGER' | 'HR' | 'MANAGER' | 'SUPERVISOR' | 'AGENT'
export type ContentType = 'VIDEO' | 'AUDIO' | 'TEXT' | 'PDF' | 'SCORM' | 'PRESENTATION'
export type EnrollmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: Role
  avatarUrl?: string
  departmentId?: string
  department?: { id: string; name: string }
  totalPoints: number
  currentStreak: number
  longestStreak: number
  lastLoginAt?: string
  isActive: boolean
  userBadges?: UserBadge[]
}

export interface Department {
  id: string
  name: string
  description?: string
  mission?: string
  icon?: string
  color?: string
  managerName?: string
  parentId?: string
  parent?: { id: string; name: string; icon?: string }
  children?: Department[]
  modules?: Module[]
  _count?: { users: number; children: number; modules: number }
}

export interface Module {
  id: string
  title: string
  description?: string
  categoryId?: string
  category?: Category
  departmentId?: string
  department?: Department
  thumbnail?: string
  estimatedMinutes: number
  isPublished: boolean
  _count?: { contents: number; enrollments: number }
  userEnrollment?: Enrollment
}

export interface Content {
  id: string
  moduleId: string
  title: string
  type: ContentType
  url?: string
  body?: string
  duration?: number
  order: number
  isRequired: boolean
  progress?: ProgressLog
}

export interface ProgressLog {
  completed: boolean
  progressPct: number
  watchedSeconds: number
}

export interface Enrollment {
  id: string
  moduleId: string
  status: EnrollmentStatus
  progressPct: number
  score?: number
  startedAt?: string
  completedAt?: string
}

export interface Quiz {
  id: string
  moduleId?: string
  title: string
  timeLimit?: number
  passingScore: number
  maxAttempts: number
  userAttemptCount?: number
  canAttempt?: boolean
  questions?: Question[]
}

export interface Question {
  id: string
  text: string
  imageUrl?: string
  options: { id: string; text: string; isCorrect?: boolean }[]
  explanation?: string
  points: number
}

export interface QuizAttempt {
  id: string
  score: number
  passed: boolean
  pointsEarned: number
  timeTaken?: number
  completedAt: string
}

export interface CareerPath {
  id: string
  title: string
  description?: string
  targetRole?: Role
  icon?: string
  color?: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  _count?: { modules: number; enrollments: number }
  userEnrollment?: CareerPathEnrollment
  modules?: CareerPathModule[]
}

export interface CareerPathModule {
  id: string
  moduleId: string
  module: Module
  order: number
  isRequired: boolean
  userStatus?: Enrollment
}

export interface CareerPathEnrollment {
  status: EnrollmentStatus
  progressPct: number
  startedAt?: string
  completedAt?: string
}

export interface KbArticle {
  id: string
  title: string
  slug: string
  body?: string
  tags: string[]
  isPublished: boolean
  isPublic?: boolean
  updatedAt: string
  category?: Category
  _count?: { views: number }
}

export interface Category {
  id: string
  name: string
  icon?: string
  color?: string
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  type: string
  points: number
}

export interface UserBadge {
  badge: Badge
  earnedAt: string
}

export type TenantStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED'

export interface Tenant {
  id: string
  name: string
  slug: string
  status: TenantStatus
  createdAt: string
  approvedAt?: string | null
  approvedBy?: string | null
}

export interface Notification {
  id: string
  title: string
  body: string
  type: string
  isRead: boolean
  link?: string
  createdAt: string
}

export interface LeaderboardEntry {
  rank: number
  id: string
  firstName: string
  lastName: string
  avatarUrl?: string
  role: Role
  totalPoints: number
  currentStreak: number
  department?: { name: string }
}
