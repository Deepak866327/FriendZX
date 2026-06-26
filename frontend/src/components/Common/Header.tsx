import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationBell } from '@/components/Notifications/NotificationBell';
import { SearchBar } from '@/components/Common/SearchBar';
import { useChatContext } from '@/context/ChatContext';
import { useChallengeContext } from '@/context/ChallengeContext';
import { DailyChallengeModal } from '@/components/Challenge/DailyChallengeModal';
import { useScrollDirection } from '@/hooks/useScrollDirection';

export const Header: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { totalUnread } = useChatContext();
  const { streak, hasDoneToday, pendingChallenges } = useChallengeContext();
  const [showDaily, setShowDaily] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollHidden = useScrollDirection();

  const isActive = (path: string) => location.pathname === path;

  // Focus the search input when overlay opens
  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [showSearch]);

  // Close search overlay on Escape
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
        <div className="search-overlay" onClick={() => setShowSearch(false)}>
          <div className="search-overlay__box" onClick={e => e.stopPropagation()}>
            <SearchBar inputRef={searchInputRef} />
            <button className="search-overlay__close" onClick={() => setShowSearch(false)}>✕</button>
          </div>
        </div>
      )}

      <header className={`header${scrollHidden ? ' header--hidden' : ''}`}>
        <div className="header-container">
          <div
            className="header-logo"
            onClick={() => navigate('/dashboard')}
            style={{ cursor: 'pointer' }}
          >
            <span className="logo-word">Freind</span><span className="logo-z">Z</span><span className="logo-x">X</span>
          </div>

          <nav className="header-nav">
            <button
              className="nav-icon-btn"
              onClick={() => setShowSearch(true)}
              title="Search"
            >
              🔍
            </button>

            <button
              className={`nav-icon-btn ${isActive('/dashboard') ? 'active' : ''}`}
              onClick={() => navigate('/dashboard')}
              title="Home"
            >
              🏠
            </button>

            <button
              className={`nav-icon-btn ${isActive('/messages') ? 'active' : ''}`}
              onClick={() => navigate('/messages')}
              title="Messages"
              style={{ position: 'relative' }}
            >
              💬
              {totalUnread > 0 && (
                <span className="nav-badge">{totalUnread > 9 ? '9+' : totalUnread}</span>
              )}
            </button>

            <button
              className={`nav-icon-btn challenge-nav-icon ${hasDoneToday ? 'challenge-nav-icon--done' : ''}`}
              onClick={() => setShowDaily(true)}
              title={`Daily Challenge${streak.current > 0 ? ` · 🔥 ${streak.current} day streak` : ''}`}
              style={{ position: 'relative' }}
            >
              ⚡
              {streak.current > 0 && (
                <span className="challenge-streak-pill">🔥{streak.current}</span>
              )}
              {pendingChallenges.length > 0 && (
                <span className="nav-badge" style={{ background: '#f59e0b' }}>
                  {pendingChallenges.length}
                </span>
              )}
            </button>

            <NotificationBell />

            <button
              className={`nav-avatar ${isActive('/profile') ? 'active' : ''}`}
              onClick={() => navigate('/profile')}
              title="Profile"
            >
              {user?.firstName?.charAt(0)?.toUpperCase() || '?'}
            </button>
          </nav>
        </div>
      </header>
    </>
  );
};
