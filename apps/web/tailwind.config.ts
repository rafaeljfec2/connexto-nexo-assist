import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FFFFFF',
        desk: '#F6F7F9',
        ink: {
          DEFAULT: '#1B2431',
          2: '#3D4656',
          3: '#5B6472',
        },
        rule: '#E6E8EC',
        cta: {
          DEFAULT: '#0062C4',
          hover: '#0054A8',
        },
        primary: {
          DEFAULT: '#0285F7',
          hover: '#0071D6',
          soft: '#0285F712',
          text: '#0069C7',
        },
        success: {
          DEFAULT: '#00BD6C',
          soft: '#00BD6C14',
          text: '#00804A',
        },
        warning: {
          DEFAULT: '#F5A500',
          soft: '#F5A50018',
          text: '#946300',
        },
        danger: {
          DEFAULT: '#EE343B',
          soft: '#EE343B12',
          text: '#C4161D',
        },
        // Legacy aliases kept for gradual migration
        navy: {
          900: '#1B2431',
          800: '#3D4656',
          700: '#5B6472',
          600: '#0062C4',
        },
        mist: {
          50: '#F6F7F9',
          100: '#EEF1F5',
          200: '#E6E8EC',
        },
        accent: {
          DEFAULT: '#0062C4',
          soft: '#0285F712',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(27, 36, 49, 0.05), 0 6px 18px rgba(27, 36, 49, 0.04)',
        input: '0 1px 2px rgba(27, 36, 49, 0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
