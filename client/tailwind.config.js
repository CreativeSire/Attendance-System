/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0f0f1a',
        surface: '#1a1a2e',
        'surface-2': '#252540',
        accent: '#6C63FF',
        'accent-light': '#9B95FF',
        border: '#2a2a3e',
        success: '#2ecc71',
        warning: '#e67e22',
        danger: '#e74c3c',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
}
