import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Dark "infra console" theme — violet accent on near-black.
        brand: {
          bg: '#0B0C10', // page background (near-black)
          surface: '#15161B', // panels / cards
          'surface-2': '#1C1E25', // hover / raised
          border: '#262833', // hairline borders
          chalice: '#3A3D4A', // neutral dots / dividers accent
          muted: '#9499A6', // secondary text
          ink: '#ECEDF1', // primary text
          primary: '#9B73F4', // violet accent (pops on dark)
          'primary-dark': '#8C60F3',
          'primary-soft': '#1E1A2E', // dark violet tint for subtle fills
        },
      },
    },
  },
  plugins: [],
};

export default config;
