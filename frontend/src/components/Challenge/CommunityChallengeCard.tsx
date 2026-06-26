import React, { useCallback, useEffect, useState } from 'react';
import challengeService, { CommunityChallenge, SubmitResult } from '@/services/challengeService';
import { QuestionCard } from './QuestionCard';
import { ResultScreen } from './ResultScreen';
import { useAuth } from '@/hooks/useAuth';

// ── Card shown in the community feed ─────────────────────────────────────────
export const CommunityChallengeCard: React.FC<{
  challenge: CommunityChallenge;
  onOpen: (id: string) => void;
  communityName?: string;
}> = ({ challenge, onOpen, communityName }) => {
  const daysLeft = Math.max(0, Math.ceil(
    (new Date(challenge.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ));

  return (
    <div className="cc-card">
      <div className="cc-card-header">
        <span className="cc-card-icon">🎯</span>
        <div className="cc-card-info">
          {communityName && <p className="cc-card-community">{communityName}</p>}
          <p className="cc-card-title">{challenge.title}</p>
          <p className="cc-card-meta">
            {challenge.attemptCount} attempt{challenge.attemptCount !== 1 ? 's' : ''} · Top: {challenge.topScore}/10 · {daysLeft}d left
          </p>
        </div>
        {challenge.myAttempt ? (
          <span className="cc-card-badge cc-card-badge--done">
            ✓ {challenge.myAttempt.score}/10
          </span>
        ) : (
          <button className="btn btn-sm btn-primary cc-card-play" onClick={() => onOpen(challenge.id)}>
            Play
          </button>
        )}
      </div>
    </div>
  );
};

// ── Full challenge modal ──────────────────────────────────────────────────────
export const CommunityChallengeModal: React.FC<{
  challengeId: string;
  onClose: () => void;
}> = ({ challengeId, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [challenge, setChallenge] = useState<CommunityChallenge | null>(null);
  const [current, setCurrent]   = useState(0);
  const [answers, setAnswers]   = useState<Record<string, number | string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]     = useState<SubmitResult | null>(null);
  const [error, setError]       = useState('');

  useEffect(() => {
    challengeService.getCommunityChallenge(challengeId)
      .then(c => { setChallenge(c); setLoading(false); })
      .catch(() => { setError('Failed to load'); setLoading(false); });
  }, [challengeId]);

  const handleSelect = useCallback((option: number | string) => {
    if (!challenge) return;
    const qId = challenge.questions[current].id;
    setAnswers(prev => ({ ...prev, [qId]: option }));
  }, [challenge, current]);

  const handleSubmit = async () => {
    if (!challenge) return;
    const unanswered = challenge.questions.filter(q => answers[q.id] === undefined);
    if (unanswered.length > 0) {
      setError(`${unanswered.length} unanswered`);
      setCurrent(challenge.questions.findIndex(q => answers[q.id] === undefined));
      return;
    }
    setSubmitting(true);
    try {
      const res = await challengeService.submitCommunityChallenge(challengeId, answers);
      setResult(res);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="challenge-modal"><div className="challenge-loading">Loading…</div></div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="modal-overlay">
        <div className="challenge-modal">
          <ResultScreen result={result} myId={user?.id} onClose={onClose} />
        </div>
      </div>
    );
  }

  if (!challenge) return null;

  if (challenge.alreadySubmitted) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="challenge-modal" onClick={e => e.stopPropagation()}>
          <div className="challenge-done">
            <div className="challenge-done-emoji">✅</div>
            <h2>{challenge.title}</h2>
            <p>Your score: <strong>{challenge.myAttempt?.score}/10</strong></p>
            <div className="result-leaderboard" style={{ marginTop: '16px' }}>
              <p className="result-leaderboard-title">🏅 Leaderboard</p>
              {challenge.leaderboard.slice(0, 5).map((e, i) => (
                <div key={e.userId} className="result-lb-row">
                  <span className="result-lb-rank">#{i + 1}</span>
                  <span className="result-lb-user">{e.userId === user?.id ? 'You' : e.userId.slice(0, 8) + '…'}</span>
                  <span className="result-lb-score">{e.score}/10</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const q = challenge.questions[current];
  const totalQ = challenge.questions.length;
  const answeredCount = Object.keys(answers).length;
  const isLast = current === totalQ - 1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="challenge-modal" onClick={e => e.stopPropagation()}>
        <div className="challenge-header">
          <div className="challenge-header-left">
            <span className="challenge-title">🏘️ {challenge.title}</span>
          </div>
          <div className="challenge-header-right">
            <span className="challenge-progress-text">{answeredCount}/{totalQ}</span>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="challenge-progress-bar">
          <div className="challenge-progress-fill" style={{ width: `${(answeredCount / totalQ) * 100}%` }} />
        </div>
        <div className="challenge-body">
          <QuestionCard
            question={q} index={current} total={totalQ}
            selected={answers[q.id] ?? null} onSelect={handleSelect}
          />
        </div>
        <div className="challenge-nav">
          <button className="btn btn-secondary challenge-nav-btn" onClick={() => setCurrent(c => c - 1)} disabled={current === 0}>
            ← Prev
          </button>
          <div className="challenge-dots">
            {challenge.questions.map((dq, i) => (
              <button key={dq.id}
                className={`challenge-dot ${i === current ? 'challenge-dot--current' : ''} ${answers[dq.id] !== undefined ? 'challenge-dot--done' : ''}`}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>
          {isLast ? (
            <button className="btn btn-primary challenge-nav-btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '…' : 'Submit'}
            </button>
          ) : (
            <button className="btn btn-primary challenge-nav-btn" onClick={() => setCurrent(c => c + 1)}>Next →</button>
          )}
        </div>
        {error && <p className="challenge-error">{error}</p>}
      </div>
    </div>
  );
};
