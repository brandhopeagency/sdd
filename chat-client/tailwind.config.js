/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary - Soft Sky Blue with Lavender undertones (calming, therapeutic)
        primary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#7c8db0',  // Main - softer, more muted
          600: '#6b7a99',
          700: '#5a6882',
          800: '#4a556b',
          900: '#3d4654',
        },
        // Secondary - Sage Green / Seafoam (nature-inspired calm)
        secondary: {
          50: '#f6f9f7',
          100: '#eef4f0',
          200: '#dce8e0',
          300: '#c2d6c8',
          400: '#a7c4b0',  // Soft sage
          500: '#8fb39a',  // Main - muted green
          600: '#7a9f86',
          700: '#658a72',
          800: '#52735e',
          900: '#435d4c',
        },
        // Neutral - Warm Stone/Sand tones (cozy, not clinical)
        neutral: {
          50: '#faf8f6',   // Warm white
          100: '#f5f2ef',  // Cream
          200: '#e8e4df',  // Light sand
          300: '#d6d0c8',  // Sand
          400: '#b5aca0',  // Warm gray
          500: '#8c8279',  // Stone
          600: '#6b635b',  // Dark stone
          700: '#504a44',  // Warm charcoal
          800: '#3a3632',  // Dark warm
          900: '#2a2724',  // Near black warm
        },
        // Accent - Soft Lavender (optional calming accent)
        accent: {
          50: '#faf8fc',
          100: '#f3eff8',
          200: '#e8e0f0',
          300: '#d4c6e3',
          400: '#b9a5d1',
          500: '#9d85be',
          600: '#8570a8',
          700: '#6e5c8f',
          800: '#5a4c75',
          900: '#4a3f60',
        },
        // Semantic colors - Softened
        success: '#7a9f86',    // Soft teal-green
        warning: '#c9a86c',    // Muted warm amber
        error: '#c98686',      // Soft coral/rose (less alarming)
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        // Softer shadows
        'soft': '0 2px 8px rgba(74, 69, 67, 0.08)',
        'soft-md': '0 4px 12px rgba(74, 69, 67, 0.1)',
        'soft-lg': '0 8px 24px rgba(74, 69, 67, 0.12)',
      },
    },
  },
  plugins: [],
}
