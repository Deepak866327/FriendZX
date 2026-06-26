import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import challengeService, { StreakInfo, FriendChallenge } from '@/services/challengeService';

interface ChallengeContextType {
  streak: StreakInfo;
  hasDoneToday: boolean;
  pendingChallenges: FriendChallenge[];
  refreshStreak: () => void;
  refreshPending: () => void;
}

const ChallengeContext = createContext<ChallengeContextType | null>(null);

export const ChallengeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [streak, setStreak] = useState<StreakInfo>({ current: 0, longest: 0, lastPassedDate: '' });
  const [hasDoneToday, setHasDoneToday] = useState(false);
  const [pendingChallenges, setPendingChallenges] = useState<FriendChallenge[]>([]);

  const refreshStreak = useCallback(() => {
    if (!isAuthenticated) return;
    challengeService.getStreak()
      .then(s => {
        setStreak(s);
        const todayStr = new Date().toISOString().split('T')[0];
        setHasDoneToday(s.lastPassedDate === todayStr);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const refreshPending = useCallback(() => {
    if (!isAuthenticated) return;
    challengeService.getPendingChallenges()
      .then(setPendingChallenges)
      .catch(() => {});
  }, [isAuthenticated]);

  // Also check if daily was attempted (not just passed)
  const checkDailyStatus = useCallback(() => {
    if (!isAuthenticated) return;
    challengeService.getDaily()
      .then(d => {
        setStreak(d.streak);
        setHasDoneToday(!!d.alreadyPassed);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    checkDailyStatus();
    refreshPending();
  }, [isAuthenticated, checkDailyStatus, refreshPending]);

  return (
    <ChallengeContext.Provider value={{ streak, hasDoneToday, pendingChallenges, refreshStreak, refreshPending }}>
      {children}
    </ChallengeContext.Provider>
  );
};

export const useChallengeContext = () => {
  const ctx = useContext(ChallengeContext);
  if (!ctx) throw new Error('useChallengeContext must be used within ChallengeProvider');
  return ctx;
};
