/** Colours come from CSS variables so every role dashboard gets its own accent. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: 'rgb(var(--accent) / <alpha-value>)', soft: 'rgb(var(--accent-soft) / <alpha-value>)', ink: 'rgb(var(--accent-ink) / <alpha-value>)' },
        paper: '#f6f5f1', ink: '#17212b',
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'], display: ['Fraunces', 'Georgia', 'serif'] },
      boxShadow: { card: '0 1px 2px rgba(23,33,43,.04), 0 8px 24px -12px rgba(23,33,43,.12)' },
    },
  },
  plugins: [],
};
