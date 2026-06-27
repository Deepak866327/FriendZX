import React from 'react';

export const SkeletonCard: React.FC = () => (
  <div className="glass rounded-2xl overflow-hidden mb-3 p-4">
    {/* Header */}
    <div className="flex items-center gap-3 mb-4">
      <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="skeleton h-3 rounded-full w-2/5" />
        <div className="skeleton h-2.5 rounded-full w-1/5" />
      </div>
    </div>

    {/* Image placeholder */}
    <div className="skeleton rounded-xl w-full" style={{ paddingTop: '75%' }} />

    {/* Actions row */}
    <div className="flex gap-3 mt-3">
      <div className="skeleton h-5 w-10 rounded-full" />
      <div className="skeleton h-5 w-10 rounded-full" />
      <div className="skeleton h-5 w-10 rounded-full" />
    </div>

    {/* Caption lines */}
    <div className="skeleton h-3 rounded-full w-3/4 mt-3" />
    <div className="skeleton h-3 rounded-full w-1/2 mt-2" />
  </div>
);
