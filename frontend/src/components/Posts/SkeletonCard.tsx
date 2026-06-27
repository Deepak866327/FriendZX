import React from 'react';

interface Props {
  /** When true, renders a text-only skeleton (no image block) */
  textOnly?: boolean;
}

export const SkeletonCard: React.FC<Props> = ({ textOnly }) => (
  <div className="glass rounded-2xl overflow-hidden mb-3 p-4">
    {/* Header */}
    <div className="flex items-center gap-3 mb-3">
      <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="skeleton h-3 rounded-full w-[38%]" />
        <div className="skeleton h-2.5 rounded-full w-[22%]" />
      </div>
    </div>

    {/* Image block — skipped for text-only */}
    {!textOnly && (
      <div className="skeleton rounded-xl w-full mb-3" style={{ paddingTop: '62%' }} />
    )}

    {/* Caption lines */}
    {textOnly && (
      <>
        <div className="skeleton h-3 rounded-full w-full mb-2" />
        <div className="skeleton h-3 rounded-full w-5/6 mb-2" />
        <div className="skeleton h-3 rounded-full w-3/5 mb-3" />
      </>
    )}

    {/* Action row */}
    <div className="flex items-center gap-4 pt-1">
      <div className="skeleton h-5 w-12 rounded-full" />
      <div className="skeleton h-5 w-8 rounded-full" />
      <div className="skeleton h-5 w-8 rounded-full" />
    </div>
  </div>
);
