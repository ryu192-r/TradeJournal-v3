/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark Discipline palette
        bg: {
          DEFAULT: '#0e1016',
          card: '#181c2a',
          'card-h': '#1d2133',
          elevated: '#1c2030',
          low: '#131621',
        },
        glass: {
          bg: 'rgba(24,28,42,.8)',
          card: 'rgba(24,28,42,.92)',
          solid: '#181c2a',
        },
        // Trading colors
        profit: {
          DEFAULT: '#4ade80',
          muted: 'rgba(74,222,128,.15)',
          faint: 'rgba(74,222,128,.08)',
        },
        loss: {
          DEFAULT: '#f87171',
          muted: 'rgba(248,113,113,.15)',
          faint: 'rgba(248,113,113,.08)',
        },
        // Text
        text: {
          DEFAULT: '#a8a39a',
          heading: '#e8e5df',
          muted: '#6e685e',
          faint: '#4a4540',
        },
        // Accent
        accent: {
          DEFAULT: '#c97a3f',
          hover: '#d9915a',
          muted: 'rgba(201,122,63,.15)',
          faint: 'rgba(201,122,63,.07)',
        },
        // Border
        border: {
          DEFAULT: 'rgba(255,255,255,.06)',
          medium: 'rgba(255,255,255,.10)',
          strong: 'rgba(255,255,255,.12)',
        },
        // Blue
        blue: {
          DEFAULT: '#6ba3d6',
          faint: 'rgba(107,163,214,.12)',
        },
        // Gold
        gold: {
          DEFAULT: '#d4a94a',
          faint: 'rgba(212,169,74,.12)',
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
        'sm': '0 1px 2px rgba(0,0,0,.20), 0 1px 4px rgba(0,0,0,.15)',
        card: '0 3px 12px rgba(0,0,0,.35), 0 1px 3px rgba(0,0,0,.20)',
        'card-lg': '0 8px 32px rgba(0,0,0,.40), 0 2px 8px rgba(0,0,0,.25)',
        glow: '0 0 40px rgba(201,122,63,.08)',
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
