import React, { useCallback, useEffect, useState } from 'react';
import challengeService, { FriendChallenge, SubmitResult } from '@/services/challengeService';
import { QuestionCard } from './QuestionCard';
import { ResultScreen } from './ResultScreen';
import { useChallengeContext } from '@/context/ChallengeContext';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  challengeId: string;
  opponentName?: string;
  onClose: () => void;
}

const TYPE_ICONS: Record<string, string>  = { math: '🔢' };
const TYPE_LABELS: Record<string, string> = { math: 'Maths' };

export const FriendChallengeModal: React.FC<Props> = ({ challengeId, opponentName, onClose }) => {
  const { user }          = useAuth();
  const { refreshPending } = useChallengeContext();

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

  const typeKey   = (challenge as any)?.challengeType ?? 'math';
  const typeIcon  = TYPE_ICONS[typeKey]  ?? '⚡';
  const typeLabel = TYPE_LABELS[typeKey] ?? 'Quiz';

  // ── Accept / Decline ─────────────────────────────────────────────────────
  const handleAccept = async () => {
    try {
      const res = await challengeService.acceptFriendChallenge(challengeId);
      setChallenge(prev => prev ? { ...prev, status: 'accepted', questions: res.questions } : prev);
    } catch {
      setError('Failed to accept challenge. Try again.');
    }
  };

  const handleDecline = async () => {
    await challengeService.declineFriendChallenge(challengeId).catch(() => {});
    refreshPending();
    onClose();
  };

  // ── Answer & Submit ───────────────────────────────────────────────────────
  const handleSelect = useCallback((option: number | string) => {
    if (!challenge) return;
    const qId = challenge.questions[current].id;
    setAnswers(prev => ({ ...prev, [qId]: option }));
  }, [challenge, current]);

  const handleSubmit = async () => {
    if (!challenge) return;
    const unanswered = challenge.questions.filter(q => answers[q.id] === undefined);
    if (unanswered.length > 0) {
      setError(`${unanswered.length} question(s) still unanswered`);
      setCurrent(challenge.questions.findIndex(q => answers[q.id] === undefined));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await challengeService.submitFriendChallenge(challengeId, answers);
      setResult(res);
      refreshPending();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Submission failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  Render states
  // ══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="challenge-modal">
          <div className="challenge-loading">Loading challenge…</div>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (!challenge && error) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="challenge-modal" onClick={e => e.stopPropagation()}>
          <div className="challenge-done">
            <div className="challenge-done-emoji">⚠️</div>
            <h2>Oops</h2>
            <p>{error}</p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (!challenge) return null;

  // ── After submitting: show own score result ────────────────────────────────
  if (result) {
    return (
      <div className="modal-overlay">
        <div className="challenge-modal">
          <ResultScreen
            result={result}
            opponentName={opponentName || (isCreator ? challenge.opponentId.slice(0, 8) : challenge.creatorId.slice(0, 8))}
            myId={user?.id}
            onClose={onClose}
          />
        </div>
      </div>
    );
  }

  // ── Opponent: pending — show Accept / Decline ─────────────────────────────
  if (challenge.status === 'pending' && isOpponent) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="challenge-modal" onClick={e => e.stopPropagation()}>
          <div className="challenge-done">
            <div className="challenge-done-emoji">{typeIcon}</div>
            <h2>Challenge Received!</h2>
            <p style={{ fontSize: '15px', fontWeight: 600 }}>
              {opponentName || challenge.creatorId.slice(0, 8)} challenged you!
            </p>
            <p style={{ fontSize: '13px', color: 'var(--tx-2)', marginTop: '4px' }}>
              {typeLabel} · 10 questions · Pass = 8/10
            </p>
            {error && <p className="challenge-error">{error}</p>}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', width: '100%' }}>
              <button className="btn btn-secondary" onClick={handleDecline} style={{ flex: 1 }}>Decline</button>
              <button className="btn btn-primary"   onClick={handleAccept}  style={{ flex: 1 }}>Accept & Play ⚡</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Creator: pending — show that they can play first ─────────────────────
  // (Creator hasn't submitted yet, opponent hasn't accepted yet — creator plays immediately)
  // This state only applies if questions are available AND creator hasn't submitted
  if (challenge.status === 'pending' && isCreator && !challenge.alreadySubmitted && challenge.questions.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="challenge-modal" onClick={e => e.stopPropagation()}>
          <div className="challenge-done">
            <div className="challenge-done-emoji">⏳</div>
            <h2>Waiting for Opponent</h2>
            <p>Waiting for them to accept before questions are available.</p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Already submitted — show waiting or final result ──────────────────────
  if (challenge.alreadySubmitted) {
    if (challenge.status === 'completed') {
      // Both done — show final scores + winner
      const myScore    = isCreator ? challenge.creatorScore : challenge.opponentScore;
      const theirScore = isCreator ? challenge.opponentScore : challenge.creatorScore;
      const winner     = myScore! > theirScore!
        ? 'you' : myScore! < theirScore! ? 'them' : 'draw';

      const outcomeEmoji = winner === 'you' ? '🏆' : winner === 'draw' ? '🤝' : '😢';
      const outcomeText  = winner === 'you' ? 'You won!' : winner === 'draw' ? "It's a draw!" : `${opponentName || 'Opponent'} won`;
      const outcomeColor = winner === 'you' ? '#22c55e' : winner === 'draw' ? '#f59e0b' : '#ef4444';

      return (
        <div className="modal-overlay" onClick={onClose}>
          <div className="challenge-modal" onClick={e => e.stopPropagation()}>
            <div className="challenge-done">
              <div className="challenge-done-emoji">{outcomeEmoji}</div>
              <h2 style={{ color: outcomeColor }}>{outcomeText}</h2>

              <div style={{ display: 'flex', gap: '32px', margin: '12px 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: '#a855f7' }}>{myScore}</div>
                  <div style={{ fontSize: '12px', color: 'var(--tx-3)' }}>You</div>
                </div>
                <div style={{ alignSelf: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--tx-3)' }}>VS</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: '#ec4899' }}>{theirScore}</div>
                  <div style={{ fontSize: '12px', color: 'var(--tx-3)' }}>{opponentName || 'Opponent'}</div>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--ig-secondary)' }}>
                {typeIcon} {typeLabel} · out of 10
              </p>
              <button className="btn btn-primary" style={{ marginTop: '16px', width: '100%' }} onClick={onClose}>Done</button>
            </div>
          </div>
        </div>
      );
    }

    // Submitted but opponent hasn't finished yet
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="challenge-modal" onClick={e => e.stopPropagation()}>
          <div className="challenge-done">
            <div className="challenge-done-emoji">⏳</div>
            <h2>Answers Submitted!</h2>
            <p>Waiting for <strong>{opponentName || 'your opponent'}</strong> to complete their turn…</p>
            <p style={{ fontSize: '12px', color: 'var(--ig-secondary)', marginTop: '8px' }}>
              You'll get a notification when they finish.
            </p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={onClose}>Got it</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active: answer questions ───────────────────────────────────────────────
  const q            = challenge.questions[current];
  const totalQ       = challenge.questions.length;
  const answeredCount = Object.keys(answers).length;
  const isLast       = current === totalQ - 1;

  if (!q) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="challenge-modal" onClick={e => e.stopPropagation()}>

        <div className="challenge-header">
          <div className="challenge-header-left">
            <span className="challenge-title">
              {typeIcon} {typeLabel} · {isCreator ? 'Your Turn' : `vs ${opponentName || 'Challenger'}`}
            </span>
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
            question={q}
            index={current}
            total={totalQ}
            selected={answers[q.id] ?? null}
            onSelect={handleSelect}
          />
        </div>

        <div className="challenge-nav">
          <button
            className="btn btn-secondary challenge-nav-btn"
            onClick={() => setCurrent(c => c - 1)}
            disabled={current === 0}
          >
            ← Prev
          </button>

          <div className="challenge-dots">
            {challenge.questions.map((dq, i) => (
              <button
                key={dq.id}
                className={`challenge-dot ${i === current ? 'challenge-dot--current' : ''} ${answers[dq.id] !== undefined ? 'challenge-dot--done' : ''}`}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>

          {isLast ? (
            <button
              className="btn btn-primary challenge-nav-btn"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit ⚡'}
            </button>
          ) : (
            <button
              className="btn btn-primary challenge-nav-btn"
              onClick={() => setCurrent(c => c + 1)}
            >
              Next →
            </button>
          )}
        </div>

        {error && <p className="challenge-error">{error}</p>}
      </div>
    </div>
  );
};
