import { apiClient } from './api';

export interface ChallengeTypeInfo {
  key: string;
  label: string;
  icon: string;
  desc: string;
}

export interface Question {
  id: string;
  text: string;
  options: (number | string)[];
}

export interface StreakInfo {
  current: number;
  longest: number;
  lastPassedDate: string;
}

export interface DailyChallenge {
  date: string;
  challengeType: string;
  typeInfo: ChallengeTypeInfo;
  questions: Question[];
  totalQuestions: number;
  passThreshold: number;
  currentAttempt: number;
  difficulty: number;
  alreadyPassed: boolean;
  canRetry: boolean;
  lastScore: number | null;
  streak: StreakInfo;
}

export interface RetryChallenge {
  questions: Question[];
  attemptNumber: number;
  difficulty: number;
  totalQuestions: number;
  passThreshold: number;
}

export interface SubmitResult {
  score: number;
  total: number;
  passed: boolean;
  passThreshold?: number;
  correctAnswers: Record<string, number | string>;
  canRetry?: boolean;
  nextDifficulty?: number | null;
  streak?: StreakInfo;
  bothDone?: boolean;
  creatorScore?: number;
  opponentScore?: number;
  winner?: string;
  leaderboard?: { userId: string; score: number }[];
}

export interface FriendChallenge {
  id: string;
  creatorId: string;
  opponentId: string;
  challengeType?: string;
  status: 'pending' | 'accepted' | 'completed' | 'declined';
  questions: Question[];
  alreadySubmitted: boolean;
  creatorScore: number | null;
  opponentScore: number | null;
  expiresAt: string;
}

export interface CommunityChallenge {
  id: string;
  communityId: string;
  creatorId: string;
  title: string;
  challengeType?: string;
  questions: Question[];
  alreadySubmitted: boolean;
  myAttempt: { score: number; passed: boolean } | null;
  leaderboard: { userId: string; score: number; submittedAt?: string }[];
  attemptCount: number;
  topScore: number;
  createdAt: string;
  expiresAt: string;
}

const challengeService = {
  // Meta
  getChallengeTypes: () =>
    apiClient.get<ChallengeTypeInfo[]>('/challenges/challenge-types').then(r => r.data),

  // Daily
  getDaily: () =>
    apiClient.get<DailyChallenge>('/challenges/daily').then(r => r.data),

  submitDaily: (answers: Record<string, number | string>) =>
    apiClient.post<SubmitResult>('/challenges/daily/submit', { answers }).then(r => r.data),

  retryDaily: () =>
    apiClient.post<RetryChallenge>('/challenges/daily/retry').then(r => r.data),

  getStreak: () =>
    apiClient.get<StreakInfo>('/challenges/daily/streak').then(r => r.data),

  // Friend
  createFriendChallenge: (opponentId: string, challengeType = 'math') =>
    apiClient.post<{ id: string; challengeType: string; status: string; expiresAt: string }>(
      '/challenges/friend', { opponentId, challengeType }
    ).then(r => r.data),

  getPendingChallenges: () =>
    apiClient.get<FriendChallenge[]>('/challenges/friend/pending').then(r => r.data),

  getMyChallenges: () =>
    apiClient.get<FriendChallenge[]>('/challenges/friend/my').then(r => r.data),

  getFriendChallenge: (id: string) =>
    apiClient.get<FriendChallenge>(`/challenges/friend/${id}`).then(r => r.data),

  acceptFriendChallenge: (id: string) =>
    apiClient.post<{ ok: boolean; questions: Question[] }>(`/challenges/friend/${id}/accept`).then(r => r.data),

  declineFriendChallenge: (id: string) =>
    apiClient.post(`/challenges/friend/${id}/decline`).then(r => r.data),

  submitFriendChallenge: (id: string, answers: Record<string, number | string>) =>
    apiClient.post<SubmitResult>(`/challenges/friend/${id}/submit`, { answers }).then(r => r.data),

  // Community
  createCommunityChallenge: (communityId: string, title: string, challengeType = 'math') =>
    apiClient.post<{ id: string }>('/challenges/community', { communityId, title, challengeType }).then(r => r.data),

  getCommunityChallenges: (communityId: string) =>
    apiClient.get<CommunityChallenge[]>(`/challenges/community/by-community/${communityId}`).then(r => r.data),

  getCommunityChallenge: (id: string) =>
    apiClient.get<CommunityChallenge>(`/challenges/community/${id}`).then(r => r.data),

  submitCommunityChallenge: (id: string, answers: Record<string, number | string>) =>
    apiClient.post<SubmitResult>(`/challenges/community/${id}/submit`, { answers }).then(r => r.data),
};

export default challengeService;
