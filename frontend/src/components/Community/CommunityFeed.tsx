import React, { useEffect, useState, useCallback } from 'react';
import { Target, Compass, Users, Plus, Flame, CheckCircle2, Edit3, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import communityService, { Community } from '@/services/communityService';
import challengeService, { CommunityChallenge } from '@/services/challengeService';
import { CommunityCard } from './CommunityCard';
import { PostFeed } from '@/components/Posts/PostFeed';
import { CreateCommunityModal } from './CreateCommunityModal';
import { CommunityChallengeCard, CommunityChallengeModal } from '@/components/Challenge/CommunityChallengeCard';
import { staggerListVariants, staggerItemVariants } from '@/utils/animations';

interface Props {
  onPostInCommunity: (communities: Community[]) => void;
  userLocation?:     { latitude: number; longitude: number } | null;
  refreshKey?:       number;
}

type View = 'feed' | 'my' | 'challenges' | 'discover';

const TABS: { id: View; label: string }[] = [
  { id: 'feed',       label: 'Home'      },
  { id: 'my',         label: 'My'        },
  { id: 'challenges', label: 'Challenges'},
  { id: 'discover',   label: 'Discover'  },
];

const Spinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 rounded-full border-[3px] border-indigo-100 border-t-indigo-500 animate-spin" />
  </div>
);

const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  cta?: string;
  onCta?: () => void;
  cta2?: string;
  onCta2?: () => void;
}> = ({ icon, title, subtitle, cta, onCta, cta2, onCta2 }) => (
  <div className="flex flex-col items-center gap-4 py-12 text-center px-6">
    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
      {icon}
    </div>
    <div className="space-y-1">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
    {cta && <button className="btn-primary px-6" onClick={onCta}>{cta}</button>}
    {cta2 && <button className="btn-secondary px-6" onClick={onCta2}>{cta2}</button>}
  </div>
);

export const CommunityFeed: React.FC<Props> = ({ onPostInCommunity, userLocation, refreshKey = 0 }) => {
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [discovered,    setDiscovered]    = useState<Community[]>([]);
  const [view,          setView]          = useState<View>('feed');
  const [showCreate,    setShowCreate]    = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [discLoading,   setDiscLoading]   = useState(false);
  const [feedRefresh,   setFeedRefresh]   = useState(0);

  const [challenges,      setChallenges]      = useState<CommunityChallenge[]>([]);
  const [chalLoading,     setChalLoading]     = useState(false);
  const [activeChalId,    setActiveChalId]    = useState<string | null>(null);
  const [showCreateChal,  setShowCreateChal]  = useState(false);
  const [chalTitle,       setChalTitle]       = useState('');
  const [chalCommunityId, setChalCommunityId] = useState('');
  const [chalCreating,    setChalCreating]    = useState(false);
  const [chalCreateError, setChalCreateError] = useState('');

  const loadMine = useCallback(async () => {
    try {
      const data = await communityService.getMine();
      setMyCommunities(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  const loadDiscover = useCallback(async () => {
    setDiscLoading(true);
    try {
      const data = await communityService.discover(userLocation?.latitude, userLocation?.longitude);
      setDiscovered(data);
    } catch { /* silent */ }
    finally { setDiscLoading(false); }
  }, [userLocation]);

  const loadChallenges = useCallback(async (communities: Community[]) => {
    if (communities.length === 0) { setChallenges([]); return; }
    setChalLoading(true);
    try {
      const results = await Promise.all(
        communities.map(c => challengeService.getCommunityChallenges(c.id).catch(() => []))
      );
      const flat   = results.flat();
      const seen   = new Set<string>();
      const unique = flat.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
      unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setChallenges(unique);
    } catch { /* silent */ }
    finally { setChalLoading(false); }
  }, []);

  useEffect(() => { loadMine(); }, [loadMine, refreshKey]);

  useEffect(() => {
    if (view === 'discover')   loadDiscover();
    if (view === 'challenges') loadChallenges(myCommunities);
  }, [view, loadDiscover, loadChallenges, myCommunities]);

  const communityPageRef = React.useRef(1);
  const myFeedFetcher = useCallback(
    (_cursor?: string) => {
      const page = _cursor ? communityPageRef.current++ : (communityPageRef.current = 1);
      return communityService.getMyFeed(page).then(r => ({
        posts:      r.posts,
        nextCursor: r.hasMore ? String(page + 1) : null,
        hasMore:    r.hasMore,
      }));
    },
    [],
  );

  const handleCreated = (c: Community) => {
    setMyCommunities(prev => [c, ...prev]);
    setFeedRefresh(k => k + 1);
  };

  const handleUpdated = () => { loadMine(); setFeedRefresh(k => k + 1); };

  const openCreateChallenge = () => {
    setChalCommunityId(myCommunities[0]?.id ?? '');
    setChalTitle(''); setChalCreateError('');
    setShowCreateChal(true);
  };

  const handleCreateChallenge = async () => {
    if (!chalCommunityId) { setChalCreateError('Select a community'); return; }
    if (!chalTitle.trim()) { setChalCreateError('Enter a challenge title'); return; }
    setChalCreating(true); setChalCreateError('');
    try {
      await challengeService.createCommunityChallenge(chalCommunityId, chalTitle.trim(), 'math');
      setShowCreateChal(false); setChalTitle('');
      loadChallenges(myCommunities);
    } catch { setChalCreateError('Failed to create challenge. Try again.'); }
    finally { setChalCreating(false); }
  };

  const totalPending = challenges.filter(c => !c.myAttempt).length;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-0">
      {/* Tab bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 overflow-x-auto no-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`relative flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              view === tab.id
                ? 'text-white shadow-md'
                : 'glass text-slate-600 hover:bg-white/70'
            }`}
            style={view === tab.id ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' } : undefined}
          >
            {tab.label}
            {tab.id === 'challenges' && totalPending > 0 && view !== 'challenges' && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {totalPending}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setShowCreate(true)}
          className="flex-shrink-0 flex items-center gap-1 ml-auto px-3 py-1.5 rounded-full text-xs font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
        >
          <Plus size={13} /> New
        </button>
      </div>

      {/* ── Feed ──────────────────────────────────────────────────────── */}
      {view === 'feed' && (
        myCommunities.length === 0 ? (
          <EmptyState
            icon={<Users size={28} className="text-indigo-400" />}
            title="No communities yet"
            subtitle="Join or create a community to see their posts here."
            cta="Discover Communities"
            onCta={() => setView('discover')}
            cta2="Create One"
            onCta2={() => setShowCreate(true)}
          />
        ) : (
          <div>
            {/* Horizontal community strip */}
            <div className="flex gap-2.5 px-4 pb-3 overflow-x-auto no-scrollbar">
              {myCommunities.map(c => (
                <CommunityCard
                  key={c.id}
                  community={c}
                  onUpdated={handleUpdated}
                  compact
                  onClick={() => onPostInCommunity(myCommunities)}
                />
              ))}
            </div>

            {/* Post-to-community CTA */}
            <div className="px-4 pb-3">
              <button
                onClick={() => onPostInCommunity(myCommunities)}
                className="w-full flex items-center gap-2.5 px-4 py-3 glass-hover rounded-2xl text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center flex-shrink-0">
                  <Edit3 size={13} className="text-indigo-500" />
                </div>
                <span className="flex-1 text-left text-xs">Post to a community…</span>
              </button>
            </div>

            <PostFeed fetcher={myFeedFetcher} refreshKey={feedRefresh + refreshKey} />
          </div>
        )
      )}

      {/* ── My communities ────────────────────────────────────────────── */}
      {view === 'my' && (
        <div className="px-4 pb-6">
          {myCommunities.length === 0 ? (
            <EmptyState
              icon={<Users size={28} className="text-indigo-400" />}
              title="No communities joined"
              cta="Discover"
              onCta={() => setView('discover')}
            />
          ) : (
            <motion.div className="space-y-3" variants={staggerListVariants} initial="hidden" animate="visible">
              {myCommunities.map(c => (
                <motion.div key={c.id} variants={staggerItemVariants}>
                  <CommunityCard community={c} onUpdated={handleUpdated} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* ── Challenges ────────────────────────────────────────────────── */}
      {view === 'challenges' && (
        <div className="px-4 pb-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-sm font-bold text-slate-800">Community Challenges</p>
              <p className="text-xs text-slate-400 mt-0.5">10 questions · 8/10 to pass</p>
            </div>
            {myCommunities.length > 0 && (
              <button
                onClick={openCreateChallenge}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
              >
                <Plus size={12} /> Create
              </button>
            )}
          </div>

          {/* Create challenge form */}
          <AnimatePresence>
            {showCreateChal && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-strong rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">New Challenge</p>
                    <button className="btn-icon text-slate-400" onClick={() => setShowCreateChal(false)}>
                      <X size={16} />
                    </button>
                  </div>

                  <select
                    className="input-glass w-full text-sm"
                    value={chalCommunityId}
                    onChange={e => setChalCommunityId(e.target.value)}
                  >
                    {myCommunities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    className="input-glass w-full"
                    placeholder="Challenge title (e.g. Monday Maths)"
                    maxLength={60}
                    value={chalTitle}
                    onChange={e => setChalTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateChallenge()}
                  />

                  <div className="flex items-center gap-2 px-3 py-2 glass rounded-xl text-xs text-slate-500">
                    <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-sm">🔢</span>
                    Maths · Arithmetic &amp; Number Sense
                  </div>

                  <AnimatePresence>
                    {chalCreateError && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200/60"
                      >
                        <AlertCircle size={13} className="text-rose-500 flex-shrink-0" />
                        <p className="text-xs text-rose-600">{chalCreateError}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-2">
                    <button className="btn-secondary flex-1 text-sm" onClick={() => setShowCreateChal(false)}>
                      Cancel
                    </button>
                    <button
                      className="btn-primary flex-1 text-sm"
                      onClick={handleCreateChallenge}
                      disabled={chalCreating || !chalTitle.trim()}
                    >
                      {chalCreating
                        ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" />
                        : 'Create'
                      }
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Challenge list */}
          {chalLoading ? (
            <Spinner />
          ) : myCommunities.length === 0 ? (
            <EmptyState
              icon={<Target size={28} className="text-indigo-400" />}
              title="Join a community first"
              subtitle="Community challenges appear once you join."
              cta="Discover Communities"
              onCta={() => setView('discover')}
            />
          ) : challenges.length === 0 ? (
            <EmptyState
              icon={<Target size={28} className="text-indigo-400" />}
              title="No active challenges"
              subtitle="Be the first — create a math challenge for your community!"
              cta="+ Create Challenge"
              onCta={openCreateChallenge}
            />
          ) : (
            <div className="space-y-4">
              {/* Pending section */}
              {challenges.filter(c => !c.myAttempt).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Flame size={13} className="text-orange-500" />
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Pending ({challenges.filter(c => !c.myAttempt).length})
                    </p>
                  </div>
                  <div className="space-y-2">
                    {challenges.filter(c => !c.myAttempt).map(c => (
                      <CommunityChallengeCard
                        key={c.id}
                        challenge={c}
                        communityName={myCommunities.find(m => m.id === c.communityId)?.name}
                        onOpen={id => setActiveChalId(id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed section */}
              {challenges.filter(c => !!c.myAttempt).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Completed</p>
                  </div>
                  <div className="space-y-2">
                    {challenges.filter(c => !!c.myAttempt).map(c => (
                      <CommunityChallengeCard
                        key={c.id}
                        challenge={c}
                        communityName={myCommunities.find(m => m.id === c.communityId)?.name}
                        onOpen={id => setActiveChalId(id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Discover ──────────────────────────────────────────────────── */}
      {view === 'discover' && (
        <div className="px-4 pb-6">
          {discLoading ? (
            <Spinner />
          ) : discovered.length === 0 ? (
            <EmptyState
              icon={<Compass size={28} className="text-indigo-400" />}
              title="No public communities yet"
              subtitle="Be the first to create one!"
              cta="Create Community"
              onCta={() => setShowCreate(true)}
            />
          ) : (
            <motion.div className="space-y-3" variants={staggerListVariants} initial="hidden" animate="visible">
              {discovered.map(c => (
                <motion.div key={c.id} variants={staggerItemVariants}>
                  <CommunityCard community={c} onUpdated={() => { loadMine(); loadDiscover(); }} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateCommunityModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          userLocation={userLocation}
        />
      )}

      {activeChalId && (
        <CommunityChallengeModal
          challengeId={activeChalId}
          onClose={() => {
            setActiveChalId(null);
            loadChallenges(myCommunities);
          }}
        />
      )}
    </div>
  );
};
