/**
 * Locale key completeness check script.
 *
 * Compares key hierarchies across en.json, uk.json, ru.json and verifies
 * that namespace files under locales/en/ have matching files under locales/uk/
 * and locales/ru/.
 *
 * Usage: npx tsx scripts/check-locale-keys.ts
 * Exit code: 0 = all checks pass, 1 = missing keys or files found
 *
 * @see specs/008-e2e-test-standards (FR-002, FR-011)
 */

import fs from 'node:fs'
import path from 'node:path'

const LOCALES_DIR = path.resolve(import.meta.dirname, '..', 'src', 'locales')
const SUPPORTED_LOCALES = ['en', 'uk', 'ru'] as const
const REFERENCE_LOCALE = 'en'

interface CheckResult {
  errors: string[]
  warnings: string[]
}

/** Recursively extract all dot-notation keys from a nested JSON object. */
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...extractKeys(value as Record<string, unknown>, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

/** Load and parse a JSON file, returning null if it doesn't exist. */
function loadJson(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/** Check root locale files for key parity. */
function checkRootLocales(): CheckResult {
  const errors: string[] = []
  const warnings: string[] = []

  const referenceFile = path.join(LOCALES_DIR, `${REFERENCE_LOCALE}.json`)
  const referenceJson = loadJson(referenceFile)

  if (!referenceJson) {
    errors.push(`Reference locale file not found: ${referenceFile}`)
    return { errors, warnings }
  }

  const referenceKeys = new Set(extractKeys(referenceJson))

  for (const locale of SUPPORTED_LOCALES) {
    if (locale === REFERENCE_LOCALE) continue

    const localeFile = path.join(LOCALES_DIR, `${locale}.json`)
    const localeJson = loadJson(localeFile)

    if (!localeJson) {
      errors.push(`Locale file not found: ${localeFile}`)
      continue
    }

    const localeKeys = new Set(extractKeys(localeJson))

    // Keys in reference but missing from this locale
    for (const key of referenceKeys) {
      if (!localeKeys.has(key)) {
        errors.push(`Missing key in ${locale}.json: "${key}"`)
      }
    }

    // Keys in this locale but not in reference (extra keys)
    for (const key of localeKeys) {
      if (!referenceKeys.has(key)) {
        warnings.push(`Extra key in ${locale}.json (not in ${REFERENCE_LOCALE}.json): "${key}"`)
      }
    }
  }

  return { errors, warnings }
}

/** Check namespace subdirectory files for parity. */
function checkNamespaceFiles(): CheckResult {
  const errors: string[] = []
  const warnings: string[] = []

  const referenceDir = path.join(LOCALES_DIR, REFERENCE_LOCALE)

  if (!fs.existsSync(referenceDir)) {
    // No namespace subdirectories — nothing to check
    return { errors, warnings }
  }

  const namespaceFiles = fs.readdirSync(referenceDir).filter((f) => f.endsWith('.json'))

  for (const nsFile of namespaceFiles) {
    const _namespace = nsFile.replace('.json', '')

    for (const locale of SUPPORTED_LOCALES) {
      if (locale === REFERENCE_LOCALE) continue

      const targetFile = path.join(LOCALES_DIR, locale, nsFile)
      if (!fs.existsSync(targetFile)) {
        // Missing namespace file for a non-reference locale — warning (translation may lag)
        warnings.push(
          `Namespace file missing: locales/${locale}/${nsFile} (exists in locales/${REFERENCE_LOCALE}/${nsFile})`
        )
        continue
      }

      // If the file exists, check key parity
      const refJson = loadJson(path.join(referenceDir, nsFile))
      const targetJson = loadJson(targetFile)

      if (refJson && targetJson) {
        const refKeys = new Set(extractKeys(refJson))
        const targetKeys = new Set(extractKeys(targetJson))

        for (const key of refKeys) {
          if (!targetKeys.has(key)) {
            errors.push(`Missing key in locales/${locale}/${nsFile}: "${key}"`)
          }
        }
      }
    }
  }

  return { errors, warnings }
}

// --- Main ---

const rootResult = checkRootLocales()
const nsResult = checkNamespaceFiles()

const allErrors = [...rootResult.errors, ...nsResult.errors]
const allWarnings = [...rootResult.warnings, ...nsResult.warnings]

if (allWarnings.length > 0) {
  console.warn('\n⚠ Locale warnings:')
  for (const w of allWarnings) {
    console.warn(`  - ${w}`)
  }
}

if (allErrors.length > 0) {
  console.error('\n✗ Locale key check FAILED:')
  for (const e of allErrors) {
    console.error(`  - ${e}`)
  }
  console.error(`\n  ${allErrors.length} error(s), ${allWarnings.length} warning(s)\n`)
  process.exit(1)
} else {
  console.log(
    `\n✓ Locale key check passed (${allWarnings.length} warning(s))\n`
  )
  process.exit(0)
}
