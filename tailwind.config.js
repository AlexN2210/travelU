/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Couleurs principales
        'gold': '#FFC857',
        'turquoise': '#00B4D8',
        'cream': '#F9F7F3',
        // Couleurs secondaires
        'burnt-orange': '#FF6F3C',
        'palm-green': '#6AA84F',
        'dark-gray': '#333333',
      },
      fontFamily: {
        'heading': ['Poppins', 'Montserrat', 'sans-serif'],
        'body': ['Inter', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        'button': '12px',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'medium': '0 4px 16px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
};
