import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0B1F3A',
          800: '#123055',
          700: '#1A3F6B',
          600: '#24568A',
        },
        mist: {
          50: '#F5F8FC',
          100: '#E8EEF6',
          200: '#D5E0EE',
        },
        accent: {
          DEFAULT: '#2F6FED',
          soft: '#E8F0FF',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 18px 50px rgba(11, 31, 58, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
