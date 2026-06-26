import React from 'react';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  message = 'Loading...',
  fullScreen = false,
}) => {
  return (
    <div className={`loading-container ${fullScreen ? 'fullscreen' : ''}`}>
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
};

export const Skeleton: React.FC<{ width?: string; height?: string; className?: string; style?: React.CSSProperties }> = ({
  width = '100%',
  height = '20px',
  className = '',
  style,
}) => {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, ...style }}
    />
  );
};

// Skeleton for profile card
export const ProfileCardSkeleton: React.FC = () => {
  return (
    <div className="profile-card skeleton-card">
      <div className="profile-header">
        <div className="skeleton" style={{ width: '80px', height: '80px', borderRadius: '50%' }} />
      </div>
      <div className="profile-content">
        <Skeleton height="24px" style={{ marginBottom: '16px' }} />
        <Skeleton height="16px" style={{ marginBottom: '12px' }} />
        <Skeleton height="60px" style={{ marginBottom: '16px' }} />
        <Skeleton height="16px" style={{ marginBottom: '12px' }} />
      </div>
    </div>
  );
};