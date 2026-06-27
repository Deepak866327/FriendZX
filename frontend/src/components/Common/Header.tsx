import React, { useState, useEffect, useRef } from 'react';
import { Search, MessageCircle, Zap, Flame, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationBell } from '@/components/Notifications/NotificationBell';
import { SearchBar } from '@/components/Common/SearchBar';
import { Logo } from '@/components/Common/Logo';
import { useChatContext } from '@/context/ChatContext';
import { useChallengeContext } from '@/context/ChallengeContext';
import { DailyChallengeModal } from '@/components/Challenge/DailyChallengeModal';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { overlayVariants } from '@/utils/animations';

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
    if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 60);
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

      {/* ── Search overlay ── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            key="search-overlay"
            className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16"
            style={{ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setShowSearch(false)}
          >
            {/* Tint layer */}
            <div className="absolute inset-0 bg-[#0f0a28]/50" />

            <motion.div
              className="relative z-10 w-full max-w-lg"
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.20, ease: [0.4, 0, 0.2, 1] }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setShowSearch(false)}
                  className="btn-icon w-8 h-8 rounded-xl glass text-slate-500 hover:text-slate-700"
                  aria-label="Close search"
                >
                  <X size={15} />
                </button>
              </div>
              <SearchBar inputRef={searchInputRef} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fixed nav bar ── */}
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
            <motion.button
              onClick={() => setShowSearch(true)}
              className="btn-icon w-9 h-9 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/60"
              aria-label="Search"
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', damping: 20, stiffness: 400 }}
            >
              <Search size={17} />
            </motion.button>

            {/* Messages */}
            <motion.button
              onClick={() => navigate('/messages')}
              className={`btn-icon relative w-9 h-9 rounded-full transition-colors ${
                isActive('/messages')
                  ? 'text-indigo-600 bg-indigo-50/70'
                  : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/60'
              }`}
              aria-label="Messages"
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', damping: 20, stiffness: 400 }}
            >
              <MessageCircle size={17} />
              <AnimatePresence>
                {totalUnread > 0 && (
                  <motion.span
                    className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', damping: 18, stiffness: 420 }}
                  >
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Daily Challenge */}
            <motion.button
              onClick={() => setShowDaily(true)}
              className={`btn-icon relative w-9 h-9 rounded-full transition-colors ${
                hasDoneToday
                  ? 'text-amber-500 bg-amber-50/70'
                  : 'text-slate-500 hover:text-amber-500 hover:bg-amber-50/60'
              }`}
              aria-label="Daily Challenge"
              title={streak.current > 0 ? `${streak.current} day streak` : 'Daily Challenge'}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', damping: 20, stiffness: 400 }}
            >
              <Zap size={17} />
              <AnimatePresence>
                {streak.current > 0 && (
                  <motion.span
                    className="absolute -top-0.5 -right-0.5 flex items-center gap-px min-w-[20px] h-4 rounded-full text-white text-[9px] font-bold px-1 leading-none"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#f97316)' }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', damping: 18, stiffness: 420 }}
                  >
                    <Flame size={7} />
                    {streak.current}
                  </motion.span>
                )}
                {pendingChallenges.length > 0 && streak.current === 0 && (
                  <motion.span
                    className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', damping: 18, stiffness: 420 }}
                  >
                    {pendingChallenges.length}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Notification bell */}
            <NotificationBell />

            {/* Profile avatar — gradient ring when on profile */}
            <motion.button
              onClick={() => navigate('/profile')}
              className="ml-1 flex-shrink-0"
              aria-label="My Profile"
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.91 }}
              transition={{ type: 'spring', damping: 20, stiffness: 400 }}
            >
              <div
                className="p-[2px] rounded-full"
                style={{
                  background: isActive('/profile')
                    ? 'linear-gradient(135deg,#6366f1,#8b5cf6,#38bdf8)'
                    : 'transparent',
                }}
              >
                <div
                  className={`w-8 h-8 rounded-full bg-gradient-to-br ${GRADIENTS[gradIdx]} flex items-center justify-center text-white font-bold text-xs`}
                  style={isActive('/profile') ? { boxShadow: 'none' } : undefined}
                >
                  {user?.firstName?.charAt(0)?.toUpperCase() || '?'}
                </div>
              </div>
            </motion.button>
          </div>
        </div>
      </header>
    </>
  );
};
