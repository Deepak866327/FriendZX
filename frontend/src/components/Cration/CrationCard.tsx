import React, { useState } from 'react';
import { Cration } from '@/services/crationService';

interface CrationCardProps {
  cration:   Cration;
  onClick:   () => void;
  onDelete?: (id: string) => void;
}

const VIS_BADGE: Record<string, string> = {
  public:  '🌐',
  friends: '🔒',
  nearby:  '📍',
};

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
    try {
      onDelete?.(cration.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="cration-card" onClick={onClick}>
      <div className="cration-card__thumb">
        {thumb
          ? <img src={thumb} alt="cration" className="cration-card__img" />
          : <video src={videoSrc} className="cration-card__img" muted playsInline preload="metadata" />
        }
        <div className="cration-card__play">▶</div>
        <div className="cration-card__vis">{VIS_BADGE[cration.visibility] ?? '🌐'}</div>

        {onDelete && (
          <button
            className="cration-card__delete"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete cration"
          >
            {deleting ? '…' : '🗑️'}
          </button>
        )}
      </div>

      <div className="cration-card__body">
        <div className="cration-card__user">@user_{cration.userId.slice(0, 6)}</div>
        {cration.caption && (
          <p className="cration-card__caption">{cration.caption}</p>
        )}
        <div className="cration-card__meta">
          <span>❤️ {cration.likesCount}</span>
          <span>👁️ {cration.views}</span>
        </div>
      </div>
    </div>
  );
};
