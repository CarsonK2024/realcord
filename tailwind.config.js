/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          dark: '#36393f',
          darker: '#2f3136',
          darkest: '#202225',
          light: '#40444b',
          lighter: '#4f545c',
          blue: '#5865f2',
          green: '#3ba55c',
          red: '#ed4245',
          yellow: '#faa61a'
        }
      }
    },
  },
  plugins: [],
} 