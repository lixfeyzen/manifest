import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Palette: "Subscription Pricing" — purple accent on light lavender.
        brand: {
          bg: '#F8F6FC', // Walkie Chalkie — app background
          surface: '#FFFFFF', // cards
          border: '#E4E0EC', // Homeopathic Lavender — hairline borders
          chalice: '#CCCAD2',
          muted: '#8E8A9C', // Gentle Grape — secondary text
          ink: '#353148', // Deep Velvet — primary text / dark elements
          primary: '#8C60F3', // Purple Anemone — primary accent
          'primary-dark': '#7747E6',
          'primary-soft': '#F1EAFE', // light purple tint for badges/hover
        },
      },
    },
  },
  plugins: [],
};

export default config;
