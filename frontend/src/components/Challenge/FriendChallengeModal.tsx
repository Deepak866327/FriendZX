import React, { useCallback, useEffect, useState } from 'react';
import { X, Zap, Swords, Clock, Trophy, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import challengeService, { FriendChallenge, SubmitResult } from '@/services/challengeService';
import { QuestionCard } from './QuestionCard';
import { ResultScreen } from './ResultScreen';
import { useChallengeContext } from '@/context/ChallengeContext';
import { useAuth } from '@/hooks/useAuth';
import { overlayVariants, modalVariants } from '@/utils/animations';

interface Props {
  challengeId:   string;
  opponentName?: string;
  onClose:       () => void;
}

/* ── Modal shell (same as Daily) ──────────────────────────────── */
const Shell: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <AnimatePresence>
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4"
      style={{ background: 'rgba(15,10,40,0.50)', backdropFilter: 'blur(6px)' }}
      variants={overlayVariants} initial="hidden" animate="visible" exit="exit"
      onClick={onClose}
    >
      <motion.div
        className="glass-strong rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md flex flex-col overflow-hidden"
        style={{ maxHeight: '92dvh' }}
        variants={modalVariants} initial="hidden" animate="visible" exit="exit"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300/70" />
        </div>
        {children}
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

/* ── Info card ────────────────────────────────────────────────── */
const InfoCard: React.FC<{
  icon:      React.ReactNode;
  title:     string;
  children:  React.ReactNode;
  onClose:   () => void;
  cta?:      string;
  secondary?: { label: string; onClick: () => void };
}> = ({ icon, title, children, onClose, cta = 'Close', secondary }) => (
  <div className="flex flex-col items-center gap-5 px-6 py-8 text-center">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
      {icon}
    </div>
    <div className="space-y-1.5">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      <div className="text-sm text-slate-500 space-y-1">{children}</div>
    </div>
    <div className="flex gap-3 w-full">
      {secondary && (
        <button className="btn-secondary flex-1" onClick={secondary.onClick}>{secondary.label}</button>
      )}
      <button className={`btn-primary ${secondary ? 'flex-1' : 'w-full'} gap-1.5`} onClick={onClose}>{cta}</button>
    </div>
  </div>
);

export const FriendChallengeModal: React.FC<Props> = ({ challengeId, opponentName, onClose }) => {
  const { user }            = useAuth();
  const { refreshPending }  = useChallengeContext();

  const [loading, setLoading]       = useState(true);
  const [challenge, setChallenge]   = useState<FriendChallenge | null>(null);
  const [current, setCurrent]       = useState(0);
  const [answers, setAnswers]       = useState<Record<string, number | string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState<SubmitResult | null>(null);
  const [error, setError]           = useState('');

  useEffect(() => {
    challengeService.getFriendChallenge(challengeId)
      .then(c  => { setChallenge(c); setLoading(false); })
      .catch(() => { setError('Failed to load challenge'); setLoading(false); });
  }, [challengeId]);

  const isCreator  = challenge?.creatorId  === user?.id;
  const isOpponent = challenge?.opponentId === user?.id;
  const typeKey    = (challenge as any)?.challengeType ?? 'math';

  const handleAccept = async () => {
    try {
      const res = await challengeService.acceptFriendChallenge(challengeId);
      setChallenge(prev => prev ? { ...prev, status: 'accepted', questions: res.questions } : prev);
    } catch { setError('Failed to accept. Try again.'); }
  };

  const handleDecline = async () => {
    await challengeService.declineFriendChallenge(challengeId).catch(() => {});
    refreshPending(); onClose();
  };

  const handleSelect = useCallback((option: number | string) => {
    if (!challenge) return;
    setAnswers(prev => ({ ...prev, [challenge.questions[current].id]: option }));
  }, [challenge, current]);

  const handleSubmit = async () => {
    if (!challenge) return;
    const unanswered = challenge.questions.filter(q => answers[q.id] === undefined);
    if (unanswered.length > 0) {
      setError(`${unanswered.length} question${unanswered.length > 1 ? 's' : ''} still unanswered`);
      setCurrent(challenge.questions.findIndex(q => answers[q.id] === undefined));
      return;
    }
    setSubmitting(true); setError('');
    try {
      const res = await challengeService.submitFriendChallenge(challengeId, answers);
      setResult(res); refreshPending();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Submission failed. Try again.');
    } finally { setSubmitting(false); }
  };

  /* Loading */
  if (loading) return (
    <Shell onClose={onClose}>
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
      </div>
    </Shell>
  );

  /* Error loading */
  if (!challenge && error) return (
    <Shell onClose={onClose}>
      <InfoCard icon={<AlertCircle size={28} className="text-rose-500" />} title="Oops" onClose={onClose}>
        <p>{error}</p>
      </InfoCard>
    </Shell>
  );

  if (!challenge) return null;

  /* Result */
  if (result) return (
    <Shell onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/30 flex-shrink-0">
        <span className="text-sm font-bold text-slate-800">Results</span>
        <button className="btn-icon text-slate-500" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <ResultScreen
          result={result}
          opponentName={opponentName || (isCreator ? challenge.opponentId.slice(0, 8) : challenge.creatorId.slice(0, 8))}
          myId={user?.id}
          onClose={onClose}
        />
      </div>
    </Shell>
  );

  /* Opponent: pending — accept/decline */
  if (challenge.status === 'pending' && isOpponent) return (
    <Shell onClose={onClose}>
      <InfoCard
        icon={<Swords size={28} className="text-indigo-500" />}
        title="Challenge Received!"
        onClose={onClose}
        cta="Accept & Play ⚡"
        secondary={{ label: 'Decline', onClick: handleDecline }}
      >
        <p className="font-semibold text-slate-700">
          {opponentName || challenge.creatorId.slice(0, 8)} challenged you!
        </p>
        <p className="text-xs text-slate-400">Maths · 10 questions · Pass = 8/10</p>
        {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
      </InfoCard>
    </Shell>
  );

  /* Creator: no questions yet */
  if (challenge.status === 'pending' && isCreator && !challenge.alreadySubmitted && challenge.questions.length === 0) return (
    <Shell onClose={onClose}>
      <InfoCard icon={<Clock size={28} className="text-amber-500" />} title="Waiting for Opponent" onClose={onClose}>
        <p>They need to accept before questions are available.</p>
      </InfoCard>
    </Shell>
  );

  /* Already submitted */
  if (challenge.alreadySubmitted) {
    if (challenge.status === 'completed') {
      const myScore    = isCreator ? challenge.creatorScore : challenge.opponentScore;
      const theirScore = isCreator ? challenge.opponentScore : challenge.creatorScore;
      const winner     = myScore! > theirScore! ? 'you' : myScore! < theirScore! ? 'them' : 'draw';
      const outcomeStyle = winner === 'you' ? 'text-emerald-700' : winner === 'draw' ? 'text-amber-700' : 'text-rose-700';
      const outcomeText  = winner === 'you' ? 'You won! 🏆' : winner === 'draw' ? "It's a draw! 🤝" : `${opponentName || 'Opponent'} won 😢`;
      return (
        <Shell onClose={onClose}>
          <InfoCard icon={<Trophy size={28} className="text-amber-500" />} title={outcomeText} onClose={onClose}>
            <p className={`text-base font-bold ${outcomeStyle}`}>{outcomeText}</p>
            <div className="flex items-center justify-center gap-6 mt-3">
              <div className="text-center">
                <p className="text-2xl font-black text-indigo-600">{myScore}</p>
                <p className="text-xs text-slate-400">You</p>
              </div>
              <span className="text-slate-300 font-black">VS</span>
              <div className="text-center">
                <p className="text-2xl font-black text-pink-600">{theirScore}</p>
                <p className="text-xs text-slate-400">{opponentName || 'Opponent'}</p>
              </div>
            </div>
          </InfoCard>
        </Shell>
      );
    }
    return (
      <Shell onClose={onClose}>
        <InfoCard icon={<Clock size={28} className="text-amber-500" />} title="Answers Submitted!" onClose={onClose} cta="Got it">
          <p>Waiting for <strong className="text-slate-700">{opponentName || 'your opponent'}</strong> to finish…</p>
          <p className="text-xs text-slate-400 mt-1">You'll get a notification when they're done.</p>
        </InfoCard>
      </Shell>
    );
  }

  /* Active quiz */
  const q            = challenge.questions[current];
  const totalQ       = challenge.questions.length;
  const answeredCount = Object.keys(answers).length;
  const isLast       = current === totalQ - 1;
  const progress     = (answeredCount / totalQ) * 100;

  if (!q) return null;

  return (
    <Shell onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Swords size={16} className="text-indigo-500" />
          <p className="text-sm font-bold text-slate-800">
            {isCreator ? 'Your Turn' : `vs ${opponentName || 'Challenger'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">{answeredCount}/{totalQ}</span>
          <button className="btn-icon text-slate-500" onClick={onClose}><X size={17} /></button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-indigo-100/60 flex-shrink-0">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <QuestionCard
          question={q} index={current} total={totalQ}
          selected={answers[q.id] ?? null} onSelect={handleSelect}
        />
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="flex items-center gap-2 mx-5 mb-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200/60"
          >
            <AlertCircle size={14} className="text-rose-500 flex-shrink-0" />
            <p className="text-xs text-rose-600">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center gap-3 px-5 py-4 border-t border-white/30 flex-shrink-0 pb-safe">
        <button
          className="btn-secondary px-4 py-2.5 text-sm"
          onClick={() => setCurrent(c => c - 1)}
          disabled={current === 0}
        >
          ← Prev
        </button>
        <div className="flex items-center gap-1.5 flex-1 justify-center flex-wrap">
          {challenge.questions.map((dq, i) => (
            <button
              key={dq.id}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all ${
                i === current               ? 'w-5 h-2 bg-indigo-500' :
                answers[dq.id] !== undefined ? 'w-2 h-2 bg-indigo-300' :
                                              'w-2 h-2 bg-slate-200'
              }`}
            />
          ))}
        </div>
        {isLast ? (
          <button className="btn-primary px-4 py-2.5 text-sm gap-1.5" onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              : <><Zap size={14} /> Submit</>
            }
          </button>
        ) : (
          <button className="btn-primary px-4 py-2.5 text-sm" onClick={() => setCurrent(c => c + 1)}>Next →</button>
        )}
      </div>
    </Shell>
  );
};
