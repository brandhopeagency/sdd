import preset from '@mentalhelpglobal/chat-frontend-common/tailwind-preset'
export default {
  presets: [preset],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    // Classes used dynamically in chat-frontend-common SurveyForm (preview mode)
    'sticky', 'bottom-0', 'pt-12', 'pb-0',
  ],
}
