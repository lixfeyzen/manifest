import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Clean light theme — white cards on near-white, violet used sparingly.
        brand: {
          bg: '#F7F8FA', // app background (near-white)
          surface: '#FFFFFF', // cards / panels
          'surface-2': '#F1F2F5', // hover / subtle fills
          border: '#E6E8EC', // hairline borders
          chalice: '#C4C7CE', // neutral dots / dividers
          muted: '#6B7280', // secondary text
          ink: '#18181B', // primary text (near-black)
          primary: '#7C5CFC', // violet accent
          'primary-dark': '#6A47E8',
          'primary-soft': '#F1ECFE', // light violet tint for subtle fills
        },
      },
    },
  },
  plugins: [],
};

export default config;
