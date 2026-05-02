// client/src/types/admin.ts

export interface AdminUser {
  id: string;
  userName: string;
  email: string;
  fullName: string;
  role: string;
  verificationStatus: string;
  requestedRole?: string;
  verificationReason?: string;
  emailVerified: boolean;
  avatarUrl?: string;
  phoneNumber?: string;
  address?: string;
  verificationImageUrls: string[];
  latestVerificationSubmittedAt?: string;
  createdAt: string;
  isSuspended: boolean;
  suspendedUntil?: string;
  banReason?: string;
  facebookUrl?: string;
  telegramUrl?: string;
}

export interface VerificationHistoryItem {
  id: number;
  requestedRole: string;
  verificationReason?: string;
  verificationImageUrls: string[];
  phoneNumber?: string;
  address?: string;
  status: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedByAdminName?: string;
}

export interface AdminUserDetail extends AdminUser {
  postCount: number;
  commentCount: number;
  pingCount: number;
  verificationHistory: VerificationHistoryItem[];
}

export interface AdminPost {
  id: number;
  content: string;
  imageUrl?: string;
  category: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  isPinned: boolean;
  isApproved: boolean;
  approvalStatus: string;
  approvedAt?: string;
  approvedByAdminName?: string;
  rejectionReason?: string;
  deletedReason?: string;
  commentCount: number;
  reactionCount: number;
}

export interface SystemLog {
  id: number;
  action: string;
  details?: string;
  userId?: string;
  userName?: string;
  targetUserId?: string;
  targetUserName?: string;
  createdAt: string;
  batchId?: string;
  hasChildren: boolean;
}

export interface Report {
  id: number;
  postId: number;
  postContentPreview: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  status: string;
  createdAt: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  adminId: string;
  adminName: string;
  createdAt: string;
  expiresAt?: string;
  isExpired: boolean;
}

export interface SystemStats {
  totalUsers: number;
  totalPersonsInNeed: number;
  totalSponsors: number;
  totalVolunteers: number;
  activeSOS: number;
  resolvedCases: number;
  totalPosts: number;
  totalPostsLivelihood: number;
  totalPostsMedical: number;
  totalPostsEducation: number;
  pendingVerifications: number;
  pendingReports: number;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BatchResult {
  applied: number;
  failed: number;
  results: BatchResultItem[];
}

export interface BatchResultItem {
  opType: string;
  key: string;
  success: boolean;
  error?: string;
}

export interface DeletedPost {
  id: number;
  content: string;
  category: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  deletedAt?: string;
  deletedByAdminName?: string;
  daysRemaining: number;
}

export interface HiddenComment {
  id: number;
  content: string;
  postId: number;
  userId: string;
  userName: string;
  createdAt: string;
  hiddenAt?: string;
  hiddenUntil?: string;
  hiddenByAdminName?: string;
  hiddenReason?: string;
  userWasNotified: boolean;
  isIndefinite: boolean;
  daysRemaining?: number;
}
