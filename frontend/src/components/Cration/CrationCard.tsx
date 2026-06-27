import React, { useState } from 'react';
import { Play, Globe, Lock, MapPin, Trash2, Heart, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cration } from '@/services/crationService';

interface CrationCardProps {
  cration:   Cration;
  onClick:   () => void;
  onDelete?: (id: string) => void;
}

const VIS_INFO: Record<string, { Icon: React.FC<{ size?: number; className?: string }>; cls: string }> = {
  public:  { Icon: Globe,  cls: 'text-emerald-300 bg-emerald-900/40' },
  friends: { Icon: Lock,   cls: 'text-indigo-300 bg-indigo-900/40'  },
  nearby:  { Icon: MapPin, cls: 'text-amber-300 bg-amber-900/40'    },
};

const SPRING = { type: 'spring', damping: 20, stiffness: 400 } as const;

export const CrationCard: React.FC<CrationCardProps> = ({ cration, onClick, onDelete }) => {
  const [deleting, setDeleting] = useState(false);

  const thumb = cration.thumbnailUrl
    ? (cration.thumbnailUrl.startsWith('http') ? cration.thumbnailUrl : `/api/crations/uploads/${cration.thumbnailUrl.split('/').pop()}`)
    : null;

  const videoSrc = cration.videoUrl.startsWith('http')
    ? cration.videoUrl
    : `/api/crations/uploads/${cration.videoUrl.split('/').pop()}`;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this cration? This cannot be undone.')) return;
    setDeleting(true);
    try { onDelete?.(cration.id); } finally { setDeleting(false); }
  };

  const vis = VIS_INFO[cration.visibility] ?? VIS_INFO.public;

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl cursor-pointer group"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
    >
      {/* Thumbnail */}
      <div className="aspect-[9/16] bg-slate-900 rounded-2xl overflow-hidden">
        {thumb
          ? <img src={thumb} alt="cration" className="w-full h-full object-cover" />
          : <video src={videoSrc} className="w-full h-full object-cover" muted playsInline preload="metadata" />
        }
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10 rounded-2xl pointer-events-none" />

      {/* Play button (hover) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}
        >
          <Play size={20} className="text-white fill-white ml-0.5" />
        </div>
      </div>

      {/* Visibility badge */}
      <div
        className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-[3px] rounded-full text-[10px] font-semibold ${vis.cls}`}
        style={{ backdropFilter: 'blur(8px)' }}
      >
        <vis.Icon size={9} />
      </div>

      {/* Delete button */}
      {onDelete && (
        <motion.button
          className="absolute top-2 right-2 w-7 h-7 rounded-xl flex items-center justify-center text-white/70 hover:text-rose-400 transition-colors"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
          onClick={handleDelete}
          disabled={deleting}
          whileTap={{ scale: 0.85 }}
          transition={SPRING}
        >
          <Trash2 size={12} />
        </motion.button>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="text-[11px] text-white/80 font-semibold mb-1 truncate">
          @user_{cration.userId.slice(0, 6)}
        </p>
        {cration.caption && (
          <p className="text-[10px] text-white/60 line-clamp-2 mb-1.5">{cration.caption}</p>
        )}
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1 text-[10px] text-white/70">
            <Heart size={9} className="text-rose-400" /> {cration.likesCount}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-white/70">
            <Eye size={9} /> {cration.views}
          </span>
        </div>
      </div>
    </motion.div>
  );
};
