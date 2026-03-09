import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ukCommon from './locales/uk/common.json';
import enCommon from './locales/en/common.json';
import ruCommon from './locales/ru/common.json';

export interface InitI18nConfig {
  /** Default namespace for the app. Falls back to 'common' if not provided. */
  namespace?: string;
  /** Additional app-specific translation resources. Keyed by language code, then namespace. */
  resources?: Record<string, Record<string, Record<string, unknown>>>;
  /** Fallback language. Defaults to 'uk'. */
  fallbackLng?: string;
  /** Initial language override (e.g. from localStorage). */
  lng?: string;
}

const commonResources = {
  uk: { common: ukCommon },
  en: { common: enCommon },
  ru: { common: ruCommon },
};

/**
 * Initialize i18next with the common namespace and optional app-specific resources.
 * Call this once at app bootstrap (e.g. in main.tsx before rendering).
 *
 * @example
 * // Minimal usage (common namespace only)
 * initI18n({});
 *
 * @example
 * // With app-specific translations
 * initI18n({
 *   namespace: 'translation',
 *   resources: {
 *     uk: {
 *       translation: { chat: { ... }, ... },
 *       review: { ... }
 *     },
 *     en: { ... },
 *     ru: { ... }
 *   }
 * });
 *
 * @example
 * // With custom fallback and stored language
 * initI18n({
 *   namespace: 'translation',
 *   fallbackLng: 'en',
 *   lng: localStorage.getItem('language') || undefined
 * });
 */
export function initI18n(config: InitI18nConfig = {}): void {
  const {
    namespace = 'common',
    resources: appResources = {},
    fallbackLng = 'uk',
    lng,
  } = config;

  const mergedResources: Record<string, Record<string, Record<string, unknown>>> = {};

  for (const lang of ['uk', 'en', 'ru'] as const) {
    mergedResources[lang] = {
      ...commonResources[lang],
      ...(appResources[lang] ?? {}),
    };
  }

  const allAppNamespaces = new Set<string>();
  for (const lang of ['uk', 'en', 'ru'] as const) {
    for (const ns of Object.keys(appResources[lang] ?? {})) {
      allAppNamespaces.add(ns);
    }
  }
  const namespaces = ['common', ...Array.from(allAppNamespaces)];

  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: mergedResources,
      ns: namespaces,
      defaultNS: namespace,
      fallbackLng,
      lng: lng ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('language') ?? undefined : undefined),

      interpolation: {
        escapeValue: false, // React already escapes
      },

      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
      },
    });

  i18n.on('languageChanged', (changedLng) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('language', changedLng);
    }
  });
}

export default i18n;
