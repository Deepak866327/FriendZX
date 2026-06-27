import React, { useCallback, useEffect, useState } from 'react';
import { X, Zap, Flame, RotateCcw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import challengeService, { DailyChallenge, Question, SubmitResult } from '@/services/challengeService';
import { QuestionCard } from './QuestionCard';
import { ResultScreen } from './ResultScreen';
import { useChallengeContext } from '@/context/ChallengeContext';
import { overlayVariants, modalVariants } from '@/utils/animations';

interface Props { onClose: () => void; }

const DIFFICULTY_LABEL: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
const DIFFICULTY_STYLE: Record<number, string> = {
  1: 'bg-emerald-100 text-emerald-700',
  2: 'bg-amber-100 text-amber-700',
  3: 'bg-rose-100 text-rose-700',
};

/* ── Reusable modal shell ─────────────────────────────────────── */
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
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300/70" />
        </div>
        {children}
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

/* ── Info card (done / waiting / error states) ────────────────── */
const InfoCard: React.FC<{
  icon:     React.ReactNode;
  title:    string;
  children: React.ReactNode;
  onClose:  () => void;
  cta?:     string;
}> = ({ icon, title, children, onClose, cta = 'Close' }) => (
  <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-3xl">
      {icon}
    </div>
    <div className="space-y-1.5">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      <div className="text-sm text-slate-500 space-y-1">{children}</div>
    </div>
    <button className="btn-primary w-full" onClick={onClose}>{cta}</button>
  </div>
);

export const DailyChallengeModal: React.FC<Props> = ({ onClose }) => {
  const { refreshStreak } = useChallengeContext();

  const [loading, setLoading]       = useState(true);
  const [daily, setDaily]           = useState<DailyChallenge | null>(null);
  const [questions, setQuestions]   = useState<Question[]>([]);
  const [current, setCurrent]       = useState(0);
  const [answers, setAnswers]       = useState<Record<string, number | string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying]     = useState(false);
  const [result, setResult]         = useState<SubmitResult | null>(null);
  const [attemptNum, setAttemptNum] = useState(1);
  const [difficulty, setDifficulty] = useState(2);
  const [error, setError]           = useState('');

  useEffect(() => {
    challengeService.getDaily()
      .then(d => {
        setDaily(d); setQuestions(d.questions);
        setAttemptNum(d.currentAttempt); setDifficulty(d.difficulty);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load challenge'); setLoading(false); });
  }, []);

  const handleSelect = useCallback((option: number | string) => {
    if (!questions.length) return;
    setAnswers(prev => ({ ...prev, [questions[current].id]: option }));
  }, [questions, current]);

  const handleSubmit = async () => {
    const unanswered = questions.filter(q => answers[q.id] === undefined);
    if (unanswered.length > 0) {
      setError(`${unanswered.length} question${unanswered.length > 1 ? 's' : ''} still unanswered`);
      setCurrent(questions.findIndex(q => answers[q.id] === undefined));
      return;
    }
    setSubmitting(true); setError('');
    try {
      const res = await challengeService.submitDaily(answers);
      setResult(res); refreshStreak();
    } catch (e: any) {
      setError(e?.response?.status === 409 ? 'Already submitted!' : 'Submission failed. Try again.');
    } finally { setSubmitting(false); }
  };

  const handleRetry = async () => {
    setRetrying(true); setError('');
    try {
      const retry = await challengeService.retryDaily();
      setQuestions(retry.questions); setAttemptNum(retry.attemptNumber);
      setDifficulty(retry.difficulty); setAnswers({}); setCurrent(0); setResult(null);
    } catch { setError('Could not load retry. Try again.'); }
    finally { setRetrying(false); }
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
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        <ResultScreen result={result} onClose={onClose} />
        {result.canRetry && (
          <div className="space-y-2 pt-1 border-t border-white/30">
            <p className="text-xs text-slate-400 text-center">
              Don't give up! Next round is a bit easier.
            </p>
            <button className="btn-secondary w-full gap-2" onClick={handleRetry} disabled={retrying}>
              {retrying
                ? <span className="w-4 h-4 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
                : <RotateCcw size={15} />
              }
              Try Again — {DIFFICULTY_LABEL[Math.max(1, difficulty - 1)]}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );

  /* Already passed */
  if (daily?.alreadyPassed) return (
    <Shell onClose={onClose}>
      <InfoCard icon="✅" title="Already Cleared!" onClose={onClose}>
        <p>Score: <strong className="text-slate-700">{daily.lastScore}/{daily.totalQuestions}</strong></p>
        {daily.streak?.current > 0 && (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <Flame size={14} className="text-orange-500" />
            <span className="font-semibold text-slate-700">{daily.streak.current} day streak</span>
          </div>
        )}
        <p className="text-slate-400 text-xs mt-1">Come back tomorrow for a new challenge!</p>
      </InfoCard>
    </Shell>
  );

  if (!daily || questions.length === 0) return null;

  const q            = questions[current];
  const totalQ       = questions.length;
  const answeredCount = Object.keys(answers).length;
  const isLast       = current === totalQ - 1;
  const progress     = (answeredCount / totalQ) * 100;

  return (
    <Shell onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/30 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
            <Zap size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate leading-tight">
              {daily.typeInfo?.label ?? 'Daily Challenge'}
            </p>
            <p className="text-[10px] text-slate-400 leading-tight">{daily.date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${DIFFICULTY_STYLE[difficulty]}`}>
            {DIFFICULTY_LABEL[difficulty]}
          </span>
          {attemptNum > 1 && (
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-violet-100 text-violet-700">
              #{attemptNum}
            </span>
          )}
          {daily.streak?.current > 0 && (
            <div className="flex items-center gap-0.5">
              <Flame size={12} className="text-orange-500" />
              <span className="text-[10px] font-bold text-orange-600">{daily.streak.current}</span>
            </div>
          )}
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

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5 flex-1 justify-center flex-wrap">
          {questions.map((dq, i) => (
            <button
              key={dq.id}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all ${
                i === current            ? 'w-5 h-2 bg-indigo-500' :
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
          <button className="btn-primary px-4 py-2.5 text-sm" onClick={() => setCurrent(c => c + 1)}>
            Next →
          </button>
        )}
      </div>
    </Shell>
  );
};
