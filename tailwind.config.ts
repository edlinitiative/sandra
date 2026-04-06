import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ── Material Design 3 tokens ─────────────────────── */
        'primary': '#aec6ff',
        'on-primary': '#002e6a',
        'primary-container': '#0070f0',
        'on-primary-container': '#fffdff',
        'primary-fixed': '#d8e2ff',
        'primary-fixed-dim': '#aec6ff',
        'on-primary-fixed': '#001a42',
        'on-primary-fixed-variant': '#004396',

        'secondary': '#b9c8de',
        'on-secondary': '#233143',
        'secondary-container': '#39485a',
        'on-secondary-container': '#a7b6cc',
        'secondary-fixed': '#d4e4fa',
        'secondary-fixed-dim': '#b9c8de',
        'on-secondary-fixed': '#0d1c2d',
        'on-secondary-fixed-variant': '#39485a',

        'tertiary': '#bcc7de',
        'on-tertiary': '#263143',
        'tertiary-container': '#6b768b',
        'on-tertiary-container': '#fffeff',
        'tertiary-fixed': '#d8e3fb',
        'tertiary-fixed-dim': '#bcc7de',
        'on-tertiary-fixed': '#111c2d',
        'on-tertiary-fixed-variant': '#3c475a',

        'error': '#ffb4ab',
        'on-error': '#690005',
        'error-container': '#93000a',
        'on-error-container': '#ffdad6',

        'surface': '#131313',
        'surface-dim': '#131313',
        'surface-bright': '#3a3939',
        'surface-container-lowest': '#0e0e0e',
        'surface-container-low': '#1c1b1b',
        'surface-container': '#201f1f',
        'surface-container-high': '#2a2a2a',
        'surface-container-highest': '#353534',
        'surface-variant': '#353534',
        'surface-tint': '#aec6ff',

        'on-surface': '#e5e2e1',
        'on-surface-variant': '#c1c6d7',
        'on-background': '#e5e2e1',

        'outline': '#8b90a0',
        'outline-variant': '#414754',

        'inverse-surface': '#e5e2e1',
        'inverse-on-surface': '#313030',
        'inverse-primary': '#005ac3',

        'background': '#131313',

        /* ── Legacy sandra scale (backward compat) ────────── */
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
        headline: ['Inter'],
        body: ['Inter'],
        label: ['Inter'],
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
