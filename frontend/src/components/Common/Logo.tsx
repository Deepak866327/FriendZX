import React from 'react';
import { clsx } from 'clsx';

interface LogoProps {
  /** 'full' = mark + wordmark  |  'mark' = icon only  |  'mono' = white mono */
  variant?: 'full' | 'mark' | 'mono';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: { mark: 28, text: 'text-base',   gap: 'gap-1.5' },
  md: { mark: 34, text: 'text-xl',     gap: 'gap-2'   },
  lg: { mark: 42, text: 'text-2xl',    gap: 'gap-2.5' },
  xl: { mark: 56, text: 'text-3xl',    gap: 'gap-3'   },
};

export const Logo: React.FC<LogoProps> = ({
  variant = 'full',
  size = 'md',
  className,
}) => {
  const { mark, text, gap } = sizeMap[size];
  const isMono = variant === 'mono';

  return (
    <div className={clsx('inline-flex items-center select-none', gap, className)}>
      {/* ── Mark — gradient rounded square with FX ── */}
      <svg
        width={mark}
        height={mark}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="flex-shrink-0"
      >
        <defs>
          <linearGradient id="fx-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#6366f1" />
            <stop offset="45%"  stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="fx-grad-mono" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.95)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.70)" />
          </linearGradient>
        </defs>

        {/* Background pill */}
        <rect
          width="40" height="40" rx="11"
          fill={isMono ? 'rgba(255,255,255,0.20)' : 'url(#fx-grad)'}
        />

        {/* Location pin shape */}
        <path
          d="M20 8C15.58 8 12 11.58 12 16C12 21.25 20 32 20 32C20 32 28 21.25 28 16C28 11.58 24.42 8 20 8Z"
          fill={isMono ? 'url(#fx-grad-mono)' : 'white'}
          opacity="0.95"
        />

        {/* Inner circle (people dot) */}
        <circle cx="20" cy="16" r="4" fill={isMono ? 'rgba(255,255,255,0.4)' : 'url(#fx-grad)'} />
        <circle cx="20" cy="16" r="2.5" fill={isMono ? 'rgba(255,255,255,0.9)' : 'white'} />
      </svg>

      {/* ── Wordmark ── */}
      {variant !== 'mark' && (
        <span
          className={clsx(
            'font-display font-700 leading-none tracking-tight',
            text,
            isMono ? 'text-white' : 'text-slate-800',
          )}
          style={{ fontWeight: 700 }}
        >
          <span className={isMono ? 'text-white' : 'gradient-text'}>Friend</span>
          <span className={clsx(isMono ? 'text-white/80' : 'text-slate-700')}>ZX</span>
        </span>
      )}
    </div>
  );
};
