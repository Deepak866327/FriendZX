import React, { useCallback, useEffect, useState } from 'react';
import challengeService, { DailyChallenge, Question, SubmitResult } from '@/services/challengeService';
import { QuestionCard } from './QuestionCard';
import { ResultScreen } from './ResultScreen';
import { useChallengeContext } from '@/context/ChallengeContext';

interface Props { onClose: () => void; }

const DIFFICULTY_LABEL: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
const DIFFICULTY_COLOR: Record<number, string> = { 1: '#22c55e', 2: '#f59e0b', 3: '#ef4444' };

export const DailyChallengeModal: React.FC<Props> = ({ onClose }) => {
  const { refreshStreak } = useChallengeContext();

  const [loading, setLoading]         = useState(true);
  const [daily, setDaily]             = useState<DailyChallenge | null>(null);
  const [questions, setQuestions]     = useState<Question[]>([]);
  const [current, setCurrent]         = useState(0);
  const [answers, setAnswers]         = useState<Record<string, number | string>>({});
  const [submitting, setSubmitting]   = useState(false);
  const [retrying, setRetrying]       = useState(false);
  const [result, setResult]           = useState<SubmitResult | null>(null);
  const [attemptNum, setAttemptNum]   = useState(1);
  const [difficulty, setDifficulty]   = useState(2);
  const [error, setError]             = useState('');

  useEffect(() => {
    challengeService.getDaily()
      .then(d => {
        setDaily(d);
        setQuestions(d.questions);
        setAttemptNum(d.currentAttempt);
        setDifficulty(d.difficulty);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load challenge'); setLoading(false); });
  }, []);

  const handleSelect = useCallback((option: number | string) => {
    if (!questions.length) return;
    const qId = questions[current].id;
    setAnswers(prev => ({ ...prev, [qId]: option }));
  }, [questions, current]);

  const handleSubmit = async () => {
    const unanswered = questions.filter(q => answers[q.id] === undefined);
    if (unanswered.length > 0) {
      setError(`Answer all questions — ${unanswered.length} remaining`);
      setCurrent(questions.findIndex(q => answers[q.id] === undefined));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await challengeService.submitDaily(answers);
      setResult(res);
      refreshStreak();
    } catch (e: any) {
      if (e?.response?.status === 409) setError('Already submitted!');
      else setError('Submission failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    setError('');
    try {
      const retry = await challengeService.retryDaily();
      setQuestions(retry.questions);
      setAttemptNum(retry.attemptNumber);
      setDifficulty(retry.difficulty);
      setAnswers({});
      setCurrent(0);
      setResult(null);
    } catch {
      setError('Could not load retry challenge. Try again.');
    } finally {
      setRetrying(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="challenge-modal">
          <div className="challenge-loading">Loading today's challenge…</div>
        </div>
      </div>
    );
  }

  // ── Result screen ─────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="modal-overlay">
        <div className="challenge-modal">
          <ResultScreen result={result} onClose={onClose} />
          {result.canRetry && (
            <div style={{ padding: '0 20px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--ig-secondary)', marginBottom: '10px' }}>
                Don't give up! Next round is a bit easier 👇
              </p>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={handleRetry}
                disabled={retrying}
              >
                {retrying ? 'Loading…' : `⚡ Try Again (${DIFFICULTY_LABEL[Math.max(1, difficulty - 1)]})`}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Already passed ────────────────────────────────────────────────────────
  if (daily?.alreadyPassed) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="challenge-modal" onClick={e => e.stopPropagation()}>
          <div className="challenge-done">
            <div className="challenge-done-emoji">✅</div>
            <h2>Already cleared!</h2>
            <p>Score: <strong>{daily.lastScore}/{daily.totalQuestions}</strong> — 🎉 Passed</p>
            {daily.typeInfo && (
              <p style={{ fontSize: '14px', color: 'var(--ig-secondary)', marginTop: '4px' }}>
                {daily.typeInfo.icon} {daily.typeInfo.label}
              </p>
            )}
            <p className="challenge-done-streak">
              🔥 Streak: <strong>{daily.streak.current} day{daily.streak.current !== 1 ? 's' : ''}</strong>
            </p>
            <p className="challenge-done-hint">Come back tomorrow for a new challenge!</p>
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (!daily || questions.length === 0) return null;

  const q            = questions[current];
  const totalQ       = questions.length;
  const answeredCount = Object.keys(answers).length;
  const isLast       = current === totalQ - 1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="challenge-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="challenge-header">
          <div className="challenge-header-left">
            <span className="challenge-title">
              ⚡ {daily.typeInfo?.icon} {daily.typeInfo?.label ?? 'Daily Challenge'}
            </span>
            <span className="challenge-date">{daily.date}</span>
          </div>
          <div className="challenge-header-right">
            <span
              className="challenge-difficulty-badge"
              style={{ background: DIFFICULTY_COLOR[difficulty] }}
            >
              {DIFFICULTY_LABEL[difficulty]}
            </span>
            {attemptNum > 1 && (
              <span className="challenge-attempt-badge">Attempt #{attemptNum}</span>
            )}
            <span className="challenge-progress-text">{answeredCount}/{totalQ}</span>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="challenge-progress-bar">
          <div
            className="challenge-progress-fill"
            style={{ width: `${(answeredCount / totalQ) * 100}%` }}
          />
        </div>

        {/* Type description + streak */}
        <div className="challenge-meta-row">
          {daily.typeInfo?.desc && (
            <span className="challenge-type-desc">{daily.typeInfo.desc}</span>
          )}
          {daily.streak.current > 0 && (
            <span className="challenge-streak-badge">🔥 {daily.streak.current} day streak</span>
          )}
        </div>

        {/* Question */}
        <div className="challenge-body">
          <QuestionCard
            question={q}
            index={current}
            total={totalQ}
            selected={answers[q.id] ?? null}
            onSelect={handleSelect}
          />
        </div>

        {/* Navigation */}
        <div className="challenge-nav">
          <button className="btn btn-secondary challenge-nav-btn" onClick={() => setCurrent(c => c - 1)} disabled={current === 0}>
            ← Prev
          </button>

          <div className="challenge-dots">
            {questions.map((dq, i) => (
              <button
                key={dq.id}
                className={`challenge-dot ${i === current ? 'challenge-dot--current' : ''} ${answers[dq.id] !== undefined ? 'challenge-dot--done' : ''}`}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>

          {isLast ? (
            <button className="btn btn-primary challenge-nav-btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit ⚡'}
            </button>
          ) : (
            <button className="btn btn-primary challenge-nav-btn" onClick={() => setCurrent(c => c + 1)}>
              Next →
            </button>
          )}
        </div>

        {error && <p className="challenge-error">{error}</p>}
      </div>
    </div>
  );
};
