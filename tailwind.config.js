/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        foreground: '#0f172a',
        primary: '#3b82f6', // blue
        'primary-foreground': '#ffffff',
        muted: '#f1f5f9',
        'muted-foreground': '#64748b',
        border: '#e2e8f0',
        accent: '#f97316', // limited orange accent
      },
      borderRadius: {
        DEFAULT: '0.375rem', // simple rounded
      }
    },
  },
  plugins: [],
}
