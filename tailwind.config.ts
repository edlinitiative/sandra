import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sandra: {
          50: '#eff8ff',
          100: '#dbeffe',
          200: '#bee3fe',
          300: '#91d2fd',
          400: '#5db9fa',
          500: '#389df6',
          600: '#2280eb',
          700: '#1a69d8',
          800: '#1b55af',
          900: '#1c498a',
          950: '#162d54',
        },
        edlight: {
          primary: '#1a69d8',
          secondary: '#162d54',
          accent: '#389df6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        soundwave: 'soundwave 1.2s ease-in-out infinite',
      },
      keyframes: {
        soundwave: {
          '0%, 100%': { transform: 'scaleY(0.2)' },
          '50%':       { transform: 'scaleY(1)'   },
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
