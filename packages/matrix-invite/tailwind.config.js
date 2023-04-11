/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      backgroundImage: {
        'hero': "url('/images/background.svg')"
      }
    },
  },
  plugins: [],
  important: true
}

