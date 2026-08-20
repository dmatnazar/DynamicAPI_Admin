/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0A0B0F',
          raised: '#111318',
          card: '#161922',
          border: '#22252E',
        },
        accent: {
          DEFAULT: '#22D3EE',
          emerald: '#34D399',
          violet: '#C792EA',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
