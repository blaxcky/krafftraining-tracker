/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        primary: '#F2A900',
        'primary-dark': '#D78F00',
        secondary: '#F2C94C',
        tertiary: '#F2B94C',
        surface: '#FFFEFA',
        muted: '#5E5340'
      },
      fontFamily: {
        sans: ['Roboto Flex Variable', 'Roboto Flex', 'Roboto', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
