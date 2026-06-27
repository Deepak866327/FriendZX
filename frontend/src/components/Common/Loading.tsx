import React from 'react';
import { Logo } from '@/components/Common/Logo';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  message = 'Loading…',
  fullScreen = false,
}) => {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
        style={{ background: 'linear-gradient(135deg,#f0f4ff 0%,#faf5ff 50%,#f0f9ff 100%)' }}
      >
        <Logo size="lg" />
        <div className="w-10 h-10 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
        {message && (
          <p className="text-sm text-slate-500 font-medium tracking-wide">{message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="w-8 h-8 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
      {message && (
        <p className="text-sm text-slate-400 font-medium">{message}</p>
      )}
    </div>
  );
};

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  rounded?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1.25rem',
  className = '',
  rounded = 'rounded-xl',
}) => (
  <div
    className={`skeleton ${rounded} ${className}`}
    style={{ width, height }}
  />
);

export const ProfileCardSkeleton: React.FC = () => (
  <div className="glass rounded-3xl p-6 space-y-4">
    {/* Avatar */}
    <div className="flex flex-col items-center gap-3 pb-4 border-b border-white/30">
      <div className="skeleton w-20 h-20 rounded-full" />
      <Skeleton width="120px" height="1.25rem" />
      <Skeleton width="80px" height="0.875rem" />
    </div>
    {/* Stats row */}
    <div className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <Skeleton width="48px" height="1.25rem" />
          <Skeleton width="56px" height="0.75rem" />
        </div>
      ))}
    </div>
    {/* Bio */}
    <div className="space-y-2">
      <Skeleton height="0.875rem" />
      <Skeleton width="75%" height="0.875rem" />
    </div>
    {/* Button */}
    <Skeleton height="2.75rem" rounded="rounded-xl" />
  </div>
);

export const PostCardSkeleton: React.FC = () => (
  <div className="glass rounded-2xl p-4 space-y-3">
    <div className="flex items-center gap-3">
      <div className="skeleton w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton width="50%" height="0.875rem" />
        <Skeleton width="35%" height="0.75rem" />
      </div>
    </div>
    <Skeleton height="12rem" rounded="rounded-xl" />
    <div className="space-y-2">
      <Skeleton height="0.875rem" />
      <Skeleton width="65%" height="0.875rem" />
    </div>
    <div className="flex gap-4 pt-1">
      {[0, 1, 2].map(i => (
        <Skeleton key={i} width="56px" height="1.5rem" rounded="rounded-lg" />
      ))}
    </div>
  </div>
);
