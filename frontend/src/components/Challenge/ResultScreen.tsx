import React from 'react';
import { SubmitResult } from '@/services/challengeService';

interface Props {
  result: SubmitResult;
  opponentName?: string;
  myId?: string;
  onClose: () => void;
}

export const ResultScreen: React.FC<Props> = ({ result, opponentName, myId, onClose }) => {
  const pct = Math.round((result.score / result.total) * 100);
  const passed = result.passed;

  const getEmoji = () => {
    if (pct === 100) return '🏆';
    if (pct >= 80) return '🎉';
    if (pct >= 50) return '👍';
    return '😓';
  };

  const winnerLine = () => {
    if (!result.bothDone || result.winner === undefined) return null;
    if (result.winner === 'draw') return <p className="result-winner result-winner--draw">🤝 It's a draw!</p>;
    const iWon = result.winner === myId;
    return (
      <p className={`result-winner ${iWon ? 'result-winner--win' : 'result-winner--lose'}`}>
        {iWon ? '🏆 You won!' : `${opponentName || 'Opponent'} won`}
      </p>
    );
  };

  return (
    <div className="result-screen">
      <div className="result-emoji">{getEmoji()}</div>
      <h2 className="result-title">{passed ? 'Challenge Passed!' : 'Better luck tomorrow'}</h2>

      <div className="result-score-ring">
        <span className="result-score-num">{result.score}</span>
        <span className="result-score-total">/ {result.total}</span>
      </div>

      <div className="result-bar-wrap">
        <div className="result-bar">
          <div className="result-bar-fill" style={{ width: `${pct}%`, background: passed ? 'var(--green)' : 'var(--accent)' }} />
        </div>
        <span className="result-pct">{pct}%</span>
      </div>

      {/* Streak info */}
      {result.streak && (
        <div className="result-streak">
          <span>🔥 Streak</span>
          <strong>{result.streak.current} day{result.streak.current !== 1 ? 's' : ''}</strong>
          {result.streak.longest > 0 && (
            <span className="result-streak-best">Best: {result.streak.longest}</span>
          )}
        </div>
      )}

      {/* Friend duel */}
      {result.bothDone && (
        <div className="result-duel">
          {winnerLine()}
          <div className="result-duel-scores">
            <div className="result-duel-side">
              <span>You</span>
              <strong>{myId === undefined ? result.creatorScore : result.score}</strong>
            </div>
            <span className="result-duel-vs">vs</span>
            <div className="result-duel-side">
              <span>{opponentName || 'Opponent'}</span>
              <strong>{result.opponentScore ?? result.creatorScore}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Community leaderboard snippet */}
      {result.leaderboard && result.leaderboard.length > 0 && (
        <div className="result-leaderboard">
          <p className="result-leaderboard-title">🏅 Top Scorers</p>
          {result.leaderboard.slice(0, 5).map((entry, i) => (
            <div key={entry.userId} className="result-lb-row">
              <span className="result-lb-rank">#{i + 1}</span>
              <span className="result-lb-user">{entry.userId === myId ? 'You' : entry.userId.slice(0, 8) + '…'}</span>
              <span className="result-lb-score">{entry.score}/{result.total}</span>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-primary result-close" onClick={onClose}>Done</button>
    </div>
  );
};
