/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          300: '#a5bcfd',
          400: '#8196fa',
          500: '#6471f5',
          600: '#5254e8',
          700: '#4442ce',
          800: '#3838a7',
          900: '#323584',
          950: '#1f1f4d',
        },
        surface: {
          DEFAULT: '#0f0f1a',
          card:    '#16162a',
          raised:  '#1e1e35',
          border:  '#2a2a4a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(100,113,245,0.3), transparent)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'equalizer':  'equalizer 1.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        equalizer: {
          '0%, 100%': { height: '4px' },
          '50%': { height: '16px' },
        },
      },
      boxShadow: {
        'glow-brand': '0 0 30px rgba(100,113,245,0.25)',
        'glow-sm':    '0 0 12px rgba(100,113,245,0.15)',
        'card':       '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
