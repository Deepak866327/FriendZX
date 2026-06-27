import React, { useState, useEffect, useRef } from 'react';
import { Search, MessageCircle, Zap, Flame, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationBell } from '@/components/Notifications/NotificationBell';
import { SearchBar } from '@/components/Common/SearchBar';
import { Logo } from '@/components/Common/Logo';
import { useChatContext } from '@/context/ChatContext';
import { useChallengeContext } from '@/context/ChallengeContext';
import { DailyChallengeModal } from '@/components/Challenge/DailyChallengeModal';
import { useScrollDirection } from '@/hooks/useScrollDirection';

const GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-violet-500 to-purple-600',
  'from-sky-400 to-blue-500',
  'from-pink-500 to-rose-500',
];

export const Header: React.FC = () => {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { totalUnread }                             = useChatContext();
  const { streak, hasDoneToday, pendingChallenges } = useChallengeContext();
  const [showDaily,  setShowDaily]  = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollHidden   = useScrollDirection();

  const isActive = (path: string) => location.pathname === path;
  const gradIdx  = (user?.id?.charCodeAt(0) ?? 0) % GRADIENTS.length;

  useEffect(() => {
    if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [showSearch]);

  useEffect(() => {
    if (!showSearch) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowSearch(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showSearch]);

  return (
    <>
      {showDaily && <DailyChallengeModal onClose={() => setShowDaily(false)} />}

      {/* Search overlay */}
      {showSearch && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16"
          style={{ background: 'rgba(15,10,40,0.55)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          onClick={() => setShowSearch(false)}
        >
          <div className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
            {/* Close row */}
            <div className="flex items-center justify-end mb-2">
              <button
                onClick={() => setShowSearch(false)}
                className="btn-icon w-8 h-8 rounded-xl glass text-slate-400 hover:text-slate-600"
                aria-label="Close search"
              >
                <X size={15} />
              </button>
            </div>
            <SearchBar inputRef={searchInputRef} />
          </div>
        </div>
      )}

      {/* Fixed nav bar */}
      <header
        className="fixed top-0 left-0 right-0 z-40 glass-nav border-b border-white/30 transition-transform duration-300"
        style={{ transform: scrollHidden ? 'translateY(-100%)' : 'translateY(0)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">

          {/* Logo */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-shrink-0 focus:outline-none"
            aria-label="Home"
          >
            <Logo variant="full" size="sm" />
          </button>

          {/* Right nav */}
          <div className="flex items-center gap-0.5 sm:gap-1">

            {/* Search */}
            <button
              onClick={() => setShowSearch(true)}
              className="btn-icon w-9 h-9 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/60"
              aria-label="Search"
            >
              <Search size={17} />
            </button>

            {/* Messages */}
            <button
              onClick={() => navigate('/messages')}
              className={`btn-icon relative w-9 h-9 rounded-xl transition-colors ${
                isActive('/messages')
                  ? 'text-indigo-600 bg-indigo-50/60'
                  : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/60'
              }`}
              aria-label="Messages"
            >
              <MessageCircle size={17} />
              {totalUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </button>

            {/* Daily Challenge */}
            <button
              onClick={() => setShowDaily(true)}
              className={`btn-icon relative w-9 h-9 rounded-xl transition-colors ${
                hasDoneToday
                  ? 'text-amber-500 bg-amber-50/60'
                  : 'text-slate-500 hover:text-amber-500 hover:bg-amber-50/60'
              }`}
              aria-label="Daily Challenge"
              title={streak.current > 0 ? `${streak.current} day streak` : 'Daily Challenge'}
            >
              <Zap size={17} />
              {streak.current > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center gap-px min-w-[20px] h-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] font-bold px-1 leading-none">
                  <Flame size={7} />
                  {streak.current}
                </span>
              )}
              {pendingChallenges.length > 0 && streak.current === 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none">
                  {pendingChallenges.length}
                </span>
              )}
            </button>

            {/* Notification bell */}
            <NotificationBell />

            {/* Profile avatar */}
            <button
              onClick={() => navigate('/profile')}
              className={`ml-1 w-8 h-8 rounded-full bg-gradient-to-br ${GRADIENTS[gradIdx]} flex items-center justify-center text-white font-bold text-xs flex-shrink-0 transition-all duration-200 ${
                isActive('/profile')
                  ? 'ring-2 ring-indigo-500 ring-offset-1'
                  : 'hover:scale-105'
              }`}
              aria-label="My Profile"
            >
              {user?.firstName?.charAt(0)?.toUpperCase() || '?'}
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
