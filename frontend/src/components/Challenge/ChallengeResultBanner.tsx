import React, { useEffect, useState } from 'react';
import { X, Zap, Trophy, Handshake } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/context/SocketContext';
import { storage } from '@/utils/storage';
import { FriendChallengeModal } from './FriendChallengeModal';

interface ChallengeResult {
  challengeId:   string;
  creatorId:     string;
  opponentId:    string;
  creatorScore:  number;
  opponentScore: number;
  winner:        string;
}

export const ChallengeResultBanner: React.FC = () => {
  const { on, off }  = useSocket();
  const [result, setResult]       = useState<ChallengeResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const currentUserId = storage.getUser()?.id ?? '';

  useEffect(() => {
    const handler = (data: ChallengeResult) => setResult(data);
    on('challenge:result', handler);
    return () => off('challenge:result', handler);
  }, [on, off]);

  if (!result) return null;

  const isCreator  = result.creatorId === currentUserId;
  const myScore    = isCreator ? result.creatorScore : result.opponentScore;
  const theirScore = isCreator ? result.opponentScore : result.creatorScore;

  const outcome =
    result.winner === 'draw'          ? { label: "It's a draw!",  style: 'from-amber-400 to-yellow-500',   icon: <Handshake size={16} className="text-white" /> }
    : result.winner === currentUserId ? { label: 'You won!',       style: 'from-emerald-400 to-green-500',  icon: <Trophy    size={16} className="text-white" /> }
    :                                   { label: 'You lost',        style: 'from-rose-400 to-red-500',       icon: <span className="text-base leading-none">😢</span> };

  const dismiss = () => { setResult(null); setShowModal(false); };

  return (
    <>
      <AnimatePresence>
        <motion.div
          className="fixed top-4 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm"
          style={{ x: '-50%' }}
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0,   scale: 1    }}
          exit={{    opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 26, stiffness: 340 }}
        >
          <div className="glass-strong rounded-2xl overflow-hidden shadow-xl shadow-indigo-200/40">
            {/* Gradient accent strip */}
            <div className={`h-1 w-full bg-gradient-to-r ${outcome.style}`} />

            <div className="px-4 py-3">
              {/* Title row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${outcome.style} flex items-center justify-center flex-shrink-0`}>
                    <Zap size={14} className="text-white" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">Challenge Complete!</span>
                </div>
                <button className="btn-icon text-slate-400" onClick={dismiss} aria-label="Dismiss">
                  <X size={16} />
                </button>
              </div>

              {/* Score row */}
              <div className="flex items-center justify-center gap-5 py-2 mb-3 glass rounded-xl">
                <div className="text-center">
                  <p className="text-2xl font-black text-indigo-600">{myScore}</p>
                  <p className="text-[10px] text-slate-400 font-medium">You</p>
                </div>
                <span className="text-slate-300 font-black text-sm">VS</span>
                <div className="text-center">
                  <p className="text-2xl font-black text-pink-600">{theirScore}</p>
                  <p className="text-[10px] text-slate-400 font-medium">Friend</p>
                </div>
              </div>

              {/* Outcome label */}
              <div className={`flex items-center justify-center gap-1.5 mb-3 py-1.5 rounded-xl bg-gradient-to-r ${outcome.style}`}>
                {outcome.icon}
                <span className="text-white text-xs font-bold">{outcome.label}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button className="btn-secondary flex-1 text-sm py-2" onClick={dismiss}>
                  Dismiss
                </button>
                <button
                  className="btn-primary flex-1 text-sm py-2"
                  onClick={() => setShowModal(true)}
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {showModal && (
        <FriendChallengeModal
          challengeId={result.challengeId}
          onClose={dismiss}
        />
      )}
    </>
  );
};
