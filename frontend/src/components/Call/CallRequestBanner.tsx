import React from 'react';
import { Phone, Video, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallContext } from '@/context/CallContext';

export const CallRequestBanner: React.FC = () => {
  const { incomingRequest, approveRequest, denyRequest } = useCallContext();

  return (
    <AnimatePresence>
      {incomingRequest && (
        <motion.div
          className="fixed top-4 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm"
          style={{ x: '-50%' }}
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0,   scale: 1    }}
          exit={{    opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 26, stiffness: 340 }}
        >
          <div className="glass-strong rounded-2xl overflow-hidden shadow-xl shadow-indigo-200/40">
            {/* Accent strip */}
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />

            <div className="flex items-center gap-3 px-4 py-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {incomingRequest.fromName.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{incomingRequest.fromName}</p>
                <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                  {incomingRequest.callType === 'video'
                    ? <><Video size={11} /> Video call request</>
                    : <><Phone size={11} /> Audio call request</>
                  }
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={denyRequest}
                  className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-500 hover:bg-rose-200 transition-colors"
                  aria-label="Deny"
                >
                  <XCircle size={18} />
                </button>
                <button
                  onClick={approveRequest}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-colors"
                  style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
                  aria-label="Allow"
                >
                  <CheckCircle2 size={18} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
