/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'var(--bg)',
          card: 'var(--bg-card)',
          'card-h': 'var(--bg-card-h)',
          elevated: 'var(--bg-elevated)',
          low: 'var(--bg-low)',
        },
        profit: {
          DEFAULT: 'var(--profit)',
          muted: 'var(--profit-muted)',
          faint: 'var(--profit-faint)',
        },
        loss: {
          DEFAULT: 'var(--loss)',
          muted: 'var(--loss-muted)',
          faint: 'var(--loss-faint)',
        },
        text: {
          DEFAULT: 'var(--text)',
          heading: 'var(--text-heading)',
          muted: 'var(--text-muted)',
          faint: 'var(--text-faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
          faint: 'var(--accent-faint)',
        },
        border: {
          DEFAULT: 'var(--border)',
          medium: 'var(--border-medium)',
          strong: 'var(--border-strong)',
        },
        gold: {
          DEFAULT: 'var(--gold)',
          faint: 'var(--gold-faint)',
        },
      },
      fontFamily: {
        display: ['Newsreader', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Consolas', 'monospace'],
        data: ['JetBrains Mono', 'monospace'],
      },
      backdropBlur: {
        glass: '12px',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        card: 'var(--shadow-card)',
        'card-lg': 'var(--shadow-card-lg)',
        glow: 'var(--shadow-glow)',
      },
      transitionDuration: {
        hover: '200ms',
        fast: '150ms',
        slow: '400ms',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.34,1.56,.64,1)',
        smooth: 'cubic-bezier(.4,0,.2,1)',
      },
      borderRadius: {
        '2xl': '14px',
        '3xl': '16px',
      },
      animation: {
        'card-in': 'cardIn .28s var(--ease-smooth) both',
        'fade-in': 'fadeIn .3s var(--ease-smooth) forwards',
        'scale-in': 'scaleIn .4s var(--ease-spring) forwards',
      },
      keyframes: {
        cardIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
