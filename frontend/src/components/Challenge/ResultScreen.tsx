import React from 'react';
import { Trophy, Handshake, Flame, Medal, Crown } from 'lucide-react';
import { SubmitResult } from '@/services/challengeService';

interface Props {
  result:        SubmitResult;
  opponentName?: string;
  myId?:         string;
  onClose:       () => void;
}

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

export const ResultScreen: React.FC<Props> = ({ result, opponentName, myId, onClose }) => {
  const pct    = Math.round((result.score / result.total) * 100);
  const passed = result.passed;

  const scoreColor = pct === 100 ? 'from-amber-400 to-yellow-500'
    : passed              ? 'from-emerald-400 to-green-500'
    :                       'from-rose-400 to-red-500';

  const winnerLine = () => {
    if (!result.bothDone || result.winner === undefined) return null;
    if (result.winner === 'draw') return (
      <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-2xl bg-amber-50 border border-amber-200/60">
        <Handshake size={16} className="text-amber-500" />
        <span className="text-sm font-semibold text-amber-700">It's a draw!</span>
      </div>
    );
    const iWon = result.winner === myId;
    return (
      <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-2xl ${
        iWon ? 'bg-emerald-50 border border-emerald-200/60' : 'bg-rose-50 border border-rose-200/60'
      }`}>
        {iWon && <Crown size={16} className="text-emerald-500" />}
        <span className={`text-sm font-semibold ${iWon ? 'text-emerald-700' : 'text-rose-700'}`}>
          {iWon ? 'You won!' : `${opponentName || 'Opponent'} won`}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      {/* Score ring */}
      <div className="relative flex items-center justify-center">
        <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${scoreColor} flex flex-col items-center justify-center shadow-xl`}>
          <span className="text-3xl font-black text-white leading-none">{result.score}</span>
          <span className="text-white/70 text-xs font-semibold">/ {result.total}</span>
        </div>
        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-md">
          {pct === 100 ? <Trophy size={16} className="text-amber-500" />
            : passed   ? <Medal  size={16} className="text-emerald-500" />
            :             <span className="text-base">😓</span>
          }
        </div>
      </div>

      {/* Title */}
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold text-slate-800">
          {passed ? 'Challenge Passed!' : 'Better luck next time'}
        </h2>
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
          passed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}>{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${scoreColor} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Streak */}
      {result.streak && (
        <div className="flex items-center gap-3 w-full px-4 py-3 glass rounded-2xl">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Flame size={18} className="text-orange-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-400">Current streak</p>
            <p className="text-sm font-bold text-slate-800">
              {result.streak.current} day{result.streak.current !== 1 ? 's' : ''}
            </p>
          </div>
          {result.streak.longest > 0 && (
            <span className="text-xs text-slate-400">
              Best: <strong className="text-slate-600">{result.streak.longest}</strong>
            </span>
          )}
        </div>
      )}

      {/* Friend duel */}
      {result.bothDone && (
        <div className="w-full space-y-3">
          {winnerLine()}
          <div className="flex items-center justify-center gap-6 py-3 glass rounded-2xl">
            <div className="text-center">
              <p className="text-2xl font-black bg-gradient-to-br from-indigo-500 to-violet-500 bg-clip-text text-transparent">
                {myId === undefined ? result.creatorScore : result.score}
              </p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">You</p>
            </div>
            <span className="text-sm font-black text-slate-300">VS</span>
            <div className="text-center">
              <p className="text-2xl font-black bg-gradient-to-br from-pink-500 to-rose-500 bg-clip-text text-transparent">
                {result.opponentScore ?? result.creatorScore}
              </p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">{opponentName || 'Opponent'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {result.leaderboard && result.leaderboard.length > 0 && (
        <div className="w-full glass rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/30 flex items-center gap-2">
            <Trophy size={14} className="text-amber-500" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Top Scorers</span>
          </div>
          <div className="divide-y divide-white/20">
            {result.leaderboard.slice(0, 5).map((entry, i) => {
              const isMe = entry.userId === myId;
              return (
                <div key={entry.userId} className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? 'bg-indigo-50/60' : ''}`}>
                  <span className="w-6 text-sm font-bold text-center">
                    {i < 3 ? RANK_EMOJI[i] : `#${i + 1}`}
                  </span>
                  <span className={`flex-1 text-sm ${isMe ? 'font-bold text-indigo-700' : 'text-slate-700'}`}>
                    {isMe ? 'You' : entry.userId.slice(0, 8) + '…'}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{entry.score}/{result.total}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button className="btn-primary w-full" onClick={onClose}>Done</button>
    </div>
  );
};
