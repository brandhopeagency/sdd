// @mentalhelpglobal/chat-frontend-common

// Runtime configuration — must be called before any API usage
export { configureApi } from './config'

// Auth store
export { useAuthStore, useHasPermission, useCanAccessWorkbench, useIsGuest } from './stores/authStore'

// Auth components
export {
  OtpLoginForm,
  WelcomeScreen,
  LoginPage,
  PendingApprovalPage,
  GoogleLoginButton,
} from './auth'

// API client & services
export { getApiBaseUrl, setOnUnauthenticated } from './services/apiClient'
export {
  authApi,
  settingsApi,
  setAccessToken,
  getAccessToken,
  clearTokens,
  setAuthRefreshHandlers,
  buildUrl,
  apiFetch,
  type ApiResponse,
  type AppSettingsDto,
  type GoogleConfigDto,
  type AuthRefreshHandlers,
} from './services/api'

// i18n
export { initI18n, default as i18n, type InitI18nConfig } from './i18n'

// Shared UI components
export { default as LanguageSelector } from './components/LanguageSelector'
export { default as GroupScopeRoute } from './components/GroupScopeRoute'

// Routes
export { default as RouteRecovery } from './routes/RouteRecovery'
export { getSurface, getSurfaceEntry, SURFACE_ROUTES, type Surface } from './routes/experienceRoutes'

// Utils
export * from './utils/permissions'
export * from './utils/piiMasking'

// Survey UI components (shared between gate and workbench preview)
export {
  SurveyForm,
  QuestionRenderer,
  SurveyProgress,
  FreeTextInput,
  SingleChoiceInput,
  MultiChoiceInput,
  BooleanInput,
  NumericInput,
  DateTimeInput,
  PresetTextInput,
  RatingScaleInput,
} from './survey-ui'
export type { SurveyFormProps } from './survey-ui'

// Types (re-exports from @mentalhelpglobal/chat-types)
export * from './types'
