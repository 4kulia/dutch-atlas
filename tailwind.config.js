/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#0b0f17',
          900: '#0f1521',
          800: '#16202f',
          700: '#1f2a3c',
          500: '#5b6b85',
          300: '#a8b3c7',
          100: '#e8edf6',
        },
        accent: {
          DEFAULT: '#ff6a3d',
          soft: '#ffb89e',
        },
        cat: {
          city_large: '#e11d48',
          city_historic: '#f59e0b',
          village: '#84cc16',
          hydraulic: '#0ea5e9',
          wind: '#06b6d4',
          nature: '#10b981',
          castle: '#a855f7',
          caribbean: '#ec4899',
          other: '#64748b',
        },
      },
      boxShadow: {
        sheet: '0 -10px 40px -10px rgba(0,0,0,0.35)',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        slideUp: 'slideUp 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        slideRight: 'slideRight 240ms cubic-bezier(0.4, 0, 0.2, 1)',
        fadeIn: 'fadeIn 180ms ease-out',
      },
    },
  },
  plugins: [],
};
