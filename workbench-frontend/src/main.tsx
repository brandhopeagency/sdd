import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { configureApi, initI18n, useAuthStore, setOnUnauthenticated } from '@mentalhelpglobal/chat-frontend-common'
import { API_URL } from './config'
import App from './App'
import './index.css'

import uk from './locales/uk.json'
import en from './locales/en.json'
import ru from './locales/ru.json'

registerSW({ immediate: true })

configureApi({ apiUrl: API_URL })
initI18n({
  namespace: 'translation',
  resources: {
    uk: { translation: uk },
    en: { translation: en },
    ru: { translation: ru },
  },
})

if (window.location.hash.startsWith('#/')) {
  const target = window.location.hash.slice(1)
  window.history.replaceState(null, '', target)
}

// Kick off cross-surface auth recovery (silent cookie-based refresh).
void useAuthStore.getState().initializeAuth()

// Redirect to login when API returns 401 after a failed refresh.
setOnUnauthenticated(() => {
  useAuthStore.getState().logout()
  window.location.replace('/login')
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
