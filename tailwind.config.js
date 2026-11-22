/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bar: {
          bg: '#0f1115',
          panel: '#171a21',
          panel2: '#1e2430',
          gold: '#c8a75a',
          text: '#e8e2d5',
          muted: '#a8a195',
          danger: '#d66'
        }
      }
    },
  },
  plugins: [],
};
