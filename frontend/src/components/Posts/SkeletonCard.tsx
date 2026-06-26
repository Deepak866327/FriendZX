import React from 'react';

export const SkeletonCard: React.FC = () => (
  <div className="post-card post-card--skeleton">
    <div className="post-card__header">
      <div className="skeleton skeleton--circle" style={{ width: 36, height: 36 }} />
      <div style={{ flex: 1, marginLeft: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton skeleton--text" style={{ width: '40%' }} />
        <div className="skeleton skeleton--text" style={{ width: '20%', height: 10 }} />
      </div>
    </div>
    <div className="skeleton skeleton--image" style={{ width: '100%', paddingTop: '100%', borderRadius: 8, marginTop: 12 }} />
    <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
      <div className="skeleton skeleton--text" style={{ width: 48 }} />
      <div className="skeleton skeleton--text" style={{ width: 48 }} />
      <div className="skeleton skeleton--text" style={{ width: 48 }} />
    </div>
    <div className="skeleton skeleton--text" style={{ width: '70%', marginTop: 10 }} />
    <div className="skeleton skeleton--text" style={{ width: '50%', marginTop: 6 }} />
  </div>
);
