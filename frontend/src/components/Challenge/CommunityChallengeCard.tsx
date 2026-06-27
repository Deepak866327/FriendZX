import React, { useCallback, useEffect, useState } from 'react';
import { X, Zap, Target, Clock, Check, AlertCircle, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import challengeService, { CommunityChallenge, SubmitResult } from '@/services/challengeService';
import { QuestionCard } from './QuestionCard';
import { ResultScreen } from './ResultScreen';
import { useAuth } from '@/hooks/useAuth';
import { overlayVariants, modalVariants } from '@/utils/animations';

/* ── Card shown in community feed ────────────────────────────── */
export const CommunityChallengeCard: React.FC<{
  challenge:      CommunityChallenge;
  onOpen:         (id: string) => void;
  communityName?: string;
}> = ({ challenge, onOpen, communityName }) => {
  const daysLeft = Math.max(0, Math.ceil(
    (new Date(challenge.expiresAt).getTime() - Date.now()) / 86_400_000,
  ));
  const done = !!challenge.myAttempt;

  return (
    <div className="glass-hover rounded-2xl p-4 flex items-center gap-3">
      {/* Icon */}
      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center flex-shrink-0">
        <Target size={20} className="text-indigo-500" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {communityName && (
          <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider truncate">
            {communityName}
          </p>
        )}
        <p className="text-sm font-semibold text-slate-800 truncate">{challenge.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-slate-400">
            {challenge.attemptCount} {challenge.attemptCount !== 1 ? 'plays' : 'play'}
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span className="text-[11px] text-slate-400">Top: {challenge.topScore}/10</span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <div className="flex items-center gap-0.5">
            <Clock size={10} className="text-slate-400" />
            <span className="text-[11px] text-slate-400">{daysLeft}d</span>
          </div>
        </div>
      </div>

      {/* CTA / badge */}
      {done ? (
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-700 flex-shrink-0">
          <Check size={11} />
          <span className="text-[11px] font-bold">{challenge.myAttempt!.score}/10</span>
        </div>
      ) : (
        <button
          onClick={() => onOpen(challenge.id)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
        >
          Play
        </button>
      )}
    </div>
  );
};

/* ── Modal shell ──────────────────────────────────────────────── */
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

/* ── Full challenge modal ─────────────────────────────────────── */
export const CommunityChallengeModal: React.FC<{
  challengeId: string;
  onClose:     () => void;
}> = ({ challengeId, onClose }) => {
  const { user }   = useAuth();
  const [loading, setLoading]       = useState(true);
  const [challenge, setChallenge]   = useState<CommunityChallenge | null>(null);
  const [current, setCurrent]       = useState(0);
  const [answers, setAnswers]       = useState<Record<string, number | string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState<SubmitResult | null>(null);
  const [error, setError]           = useState('');

  useEffect(() => {
    challengeService.getCommunityChallenge(challengeId)
      .then(c => { setChallenge(c); setLoading(false); })
      .catch(() => { setError('Failed to load'); setLoading(false); });
  }, [challengeId]);

  const handleSelect = useCallback((option: number | string) => {
    if (!challenge) return;
    setAnswers(prev => ({ ...prev, [challenge.questions[current].id]: option }));
  }, [challenge, current]);

  const handleSubmit = async () => {
    if (!challenge) return;
    const unanswered = challenge.questions.filter(q => answers[q.id] === undefined);
    if (unanswered.length > 0) {
      setError(`${unanswered.length} question${unanswered.length > 1 ? 's' : ''} unanswered`);
      setCurrent(challenge.questions.findIndex(q => answers[q.id] === undefined));
      return;
    }
    setSubmitting(true); setError('');
    try {
      const res = await challengeService.submitCommunityChallenge(challengeId, answers);
      setResult(res);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Submission failed');
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

  /* Result */
  if (result) return (
    <Shell onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/30 flex-shrink-0">
        <span className="text-sm font-bold text-slate-800">Results</span>
        <button className="btn-icon text-slate-500" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <ResultScreen result={result} myId={user?.id} onClose={onClose} />
      </div>
    </Shell>
  );

  if (!challenge) return null;

  /* Already submitted — show score + leaderboard */
  if (challenge.alreadySubmitted) return (
    <Shell onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/30 flex-shrink-0">
        <span className="text-sm font-bold text-slate-800 truncate">{challenge.title}</span>
        <button className="btn-icon text-slate-500" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {/* Score */}
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex flex-col items-center justify-center shadow-lg">
            <span className="text-2xl font-black text-white">{challenge.myAttempt?.score}</span>
            <span className="text-white/70 text-xs">/10</span>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">Completed ✓</span>
        </div>

        {/* Leaderboard */}
        {challenge.leaderboard.length > 0 && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/30 flex items-center gap-2">
              <Trophy size={14} className="text-amber-500" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Leaderboard</span>
            </div>
            <div className="divide-y divide-white/20">
              {challenge.leaderboard.slice(0, 5).map((e, i) => {
                const isMe = e.userId === user?.id;
                return (
                  <div key={e.userId} className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? 'bg-indigo-50/60' : ''}`}>
                    <span className="w-6 text-sm font-bold text-center">
                      {['🥇','🥈','🥉'][i] ?? `#${i+1}`}
                    </span>
                    <span className={`flex-1 text-sm ${isMe ? 'font-bold text-indigo-700' : 'text-slate-700'}`}>
                      {isMe ? 'You' : e.userId.slice(0, 8) + '…'}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{e.score}/10</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <button className="btn-primary w-full" onClick={onClose}>Close</button>
      </div>
    </Shell>
  );

  /* Active quiz */
  const q            = challenge.questions[current];
  const totalQ       = challenge.questions.length;
  const answeredCount = Object.keys(answers).length;
  const isLast       = current === totalQ - 1;
  const progress     = (answeredCount / totalQ) * 100;

  return (
    <Shell onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/30 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Target size={16} className="text-indigo-500 flex-shrink-0" />
          <p className="text-sm font-bold text-slate-800 truncate">{challenge.title}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
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
