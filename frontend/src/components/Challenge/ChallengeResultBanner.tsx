import React, { useEffect, useState } from 'react';
import { useSocket } from '@/context/SocketContext';
import { storage } from '@/utils/storage';
import { FriendChallengeModal } from './FriendChallengeModal';

interface ChallengeResult {
  challengeId: string;
  creatorId: string;
  opponentId: string;
  creatorScore: number;
  opponentScore: number;
  winner: string;
}

export const ChallengeResultBanner: React.FC = () => {
  const { on, off } = useSocket();
  const [result, setResult]         = useState<ChallengeResult | null>(null);
  const [showModal, setShowModal]   = useState(false);
  const currentUserId = storage.getUser()?.id ?? '';

  useEffect(() => {
    const handler = (data: ChallengeResult) => {
      setResult(data);
    };
    on('challenge:result', handler);
    return () => off('challenge:result', handler);
  }, [on, off]);

  if (!result) return null;

  const isCreator  = result.creatorId === currentUserId;
  const myScore    = isCreator ? result.creatorScore : result.opponentScore;
  const theirScore = isCreator ? result.opponentScore : result.creatorScore;

  const outcome =
    result.winner === 'draw'          ? { label: "It's a draw! 🤝", color: '#f59e0b' }
    : result.winner === currentUserId ? { label: 'You won! 🏆',      color: '#22c55e' }
    :                                   { label: 'You lost 😢',       color: '#ef4444' };

  return (
    <div className="challenge-result-banner">
      <div className="challenge-result-banner__glow" style={{ background: outcome.color }} />

      <div className="challenge-result-banner__body">
        <div className="challenge-result-banner__title">⚡ Challenge Complete!</div>

        <div className="challenge-result-banner__scores">
          <div className="challenge-result-banner__score-block">
            <span className="challenge-result-banner__score">{myScore}</span>
            <span className="challenge-result-banner__score-label">You</span>
          </div>
          <span className="challenge-result-banner__vs">VS</span>
          <div className="challenge-result-banner__score-block">
            <span className="challenge-result-banner__score">{theirScore}</span>
            <span className="challenge-result-banner__score-label">Friend</span>
          </div>
        </div>

        <div
          className="challenge-result-banner__outcome"
          style={{ color: outcome.color }}
        >
          {outcome.label}
        </div>

        <div className="challenge-result-banner__actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setResult(null); setShowModal(false); }}
          >
            Dismiss
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowModal(true)}
          >
            View Details
          </button>
        </div>
      </div>

      {showModal && (
        <FriendChallengeModal
          challengeId={result.challengeId}
          onClose={() => { setShowModal(false); setResult(null); }}
        />
      )}
    </div>
  );
};
