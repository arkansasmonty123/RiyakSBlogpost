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
          goldSoft: '#d8bd7a',
          text: '#e8e2d5',
          muted: '#a8a195',
          danger: '#d66',
          line: 'rgba(200, 167, 90, 0.18)',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body: ['"Source Sans 3"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 8px 30px rgba(0, 0, 0, 0.28)',
      },
    },
  },
  plugins: [],
};
