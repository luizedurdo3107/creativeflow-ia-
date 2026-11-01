/** @type {import('tailwindcss').Config} */
// Paleta da Lumos Connect, extraída do site original da marca.
const lumos = { 50: '#F1F5EF', 100: '#DCE7DA', 200: '#C8D9C9', 300: '#ABC3B0', 400: '#8EAE96', 500: '#6F9279', 600: '#4E6F5A', 700: '#3B5645', 800: '#31493A', 900: '#2B3B36', 950: '#1C2822' };
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], display: ['Poppins', 'Inter', 'sans-serif'] },
      colors: {
        brand: lumos,
        teal: lumos,
        violet: lumos,
        accent: { 100: '#C7DEDB', 500: '#8FB3AE', 700: '#3B5645' },
        slate: { 50: '#F5F3EC', 100: '#E6E8E0', 200: '#D3D9CC', 300: '#B8C5BC', 400: '#8FA195', 500: '#68766F', 600: '#5B6B65', 700: '#3B5645', 800: '#2B3B36', 900: '#1F2F29', 950: '#15231D' },
      },
    },
  },
  plugins: [],
};
