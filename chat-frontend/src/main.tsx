import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'
import './i18n'
import { useAuthStore } from './stores/authStore'
import { setOnUnauthenticated } from './services/apiClient'

registerSW({ immediate: true })

// Backward compatibility: migrate old hash-based deep links to path-based routes.
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
