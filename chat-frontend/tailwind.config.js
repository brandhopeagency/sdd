import sharedPreset from '@mentalhelpglobal/chat-frontend-common/tailwind-preset';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [sharedPreset],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
