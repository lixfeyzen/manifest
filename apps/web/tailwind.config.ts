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
        // Clean light theme: white cards on near-white, violet used sparingly.
        brand: {
          bg: '#F7F8FA', // app background (near-white)
          surface: '#FFFFFF', // cards / panels
          'surface-2': '#F1F2F5', // hover / subtle fills
          border: '#E6E8EC', // hairline borders
          chalice: '#C4C7CE', // neutral dots / dividers
          muted: '#5F6B7A', // secondary text (AA-contrast on bg and surface)
          ink: '#18181B', // primary text (near-black)
          primary: '#6A47E8', // violet accent (white text on it passes AA)
          'primary-dark': '#5B39D6', // darker hover
          'primary-soft': '#F1ECFE', // light violet tint for subtle fills
        },
      },
    },
  },
  plugins: [],
};

export default config;
