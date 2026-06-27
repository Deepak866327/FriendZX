/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // ── Brand colours ───────────────────────────────────────────────────────
      colors: {
        fx: {
          indigo:  '#4f46e5',
          violet:  '#8b5cf6',
          sky:     '#38bdf8',
          blue:    '#3b82f6',
          bg:      '#f5f7ff',
          online:  '#22c55e',
          away:    '#f59e0b',
          offline: '#94a3b8',
        },
      },

      // ── Typography ──────────────────────────────────────────────────────────
      fontFamily: {
        sans:    ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },

      // ── Border radius extras ────────────────────────────────────────────────
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },

      // ── Box shadows (glass depth layers) ───────────────────────────────────
      boxShadow: {
        'glass':        '0 8px 32px rgba(99,102,241,0.10), inset 0 1px 0 rgba(255,255,255,0.55)',
        'glass-strong': '0 16px 48px rgba(99,102,241,0.16), inset 0 1px 0 rgba(255,255,255,0.65)',
        'glass-sm':     '0 4px 16px rgba(99,102,241,0.08)',
        'glass-nav':    '0 -4px 24px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.60)',
        'card-lift':    '0 20px 60px rgba(99,102,241,0.18)',
        'btn-primary':  '0 4px 14px rgba(99,102,241,0.30)',
        'btn-glow':     '0 0 20px rgba(139,92,246,0.35)',
        'avatar':       '0 4px 12px rgba(99,102,241,0.20)',
      },

      // ── Background gradients ────────────────────────────────────────────────
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 45%, #38bdf8 100%)',
        'gradient-story':   'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #38bdf8 100%)',
        'gradient-page':    'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #f0f9ff 100%)',
        'gradient-card':    'linear-gradient(145deg, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.40) 100%)',
        'gradient-shimmer': 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      },

      // ── Backdrop blur extras ────────────────────────────────────────────────
      backdropBlur: {
        xs:   '4px',
        '3xl':'64px',
      },

      // ── Animations ─────────────────────────────────────────────────────────
      animation: {
        'shimmer':    'shimmer 2s linear infinite',
        'blob':       'blob 10s ease-in-out infinite',
        'blob-slow':  'blob 14s ease-in-out infinite reverse',
        'float':      'float 6s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':    'fade-in 0.3s ease-out',
        'slide-up':   'slide-up 0.3s ease-out',
      },

      keyframes: {
        shimmer: {
          '0%':    { backgroundPosition: '-200% 0' },
          '100%':  { backgroundPosition:  '200% 0' },
        },
        blob: {
          '0%, 100%': { transform: 'translate(0px,0px) scale(1)' },
          '33%':      { transform: 'translate(30px,-25px) scale(1.06)' },
          '66%':      { transform: 'translate(-20px,15px) scale(0.94)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-12px)' },
        },
        'pulse-ring': {
          '0%':    { transform: 'scale(1)',   opacity: '1' },
          '100%':  { transform: 'scale(1.6)', opacity: '0' },
        },
        'fade-in': {
          '0%':    { opacity: '0' },
          '100%':  { opacity: '1' },
        },
        'slide-up': {
          '0%':    { opacity: '0', transform: 'translateY(12px)' },
          '100%':  { opacity: '1', transform: 'translateY(0)' },
        },
      },

      // ── Spacing extras ──────────────────────────────────────────────────────
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-t': 'env(safe-area-inset-top)',
      },
    },
  },
  plugins: [],
}
