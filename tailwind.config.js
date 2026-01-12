/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Be Vietnam Pro', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        accent: {
          orange: '#f97316',
          red: '#ef4444',
          blue: '#3b82f6',
        }
      },
      boxShadow: {
        'card': '0 2px 8px -2px rgba(0, 0, 0, 0.1), 0 4px 12px -4px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 8px 24px -8px rgba(0, 0, 0, 0.15), 0 12px 32px -12px rgba(0, 0, 0, 0.1)',
        'modal': '0 24px 48px -12px rgba(0, 0, 0, 0.25)',
      }
    },
  },
  plugins: [],
}
