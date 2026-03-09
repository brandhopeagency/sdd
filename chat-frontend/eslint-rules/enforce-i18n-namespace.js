/**
 * ESLint rule: enforce-i18n-namespace
 *
 * Ensures that components within feature directories call useTranslation()
 * with the correct namespace argument matching the directory's designated
 * i18n namespace.
 *
 * @see specs/008-e2e-test-standards/contracts/eslint-rule-schema.json
 */

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that useTranslation() calls within feature directories use the correct i18n namespace',
      recommended: true,
    },
    messages: {
      missingNamespace:
        "useTranslation() in '{{directory}}' must specify the '{{expected}}' namespace: useTranslation('{{expected}}')",
      wrongNamespace:
        "useTranslation('{{actual}}') in '{{directory}}' should be useTranslation('{{expected}}')",
    },
    schema: [
      {
        type: 'object',
        properties: {
          namespaceMap: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
        required: ['namespaceMap'],
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {}
    const namespaceMap = options.namespaceMap || {}

    // Normalize the file path to use forward slashes for cross-platform matching
    const filePath = context.filename.replace(/\\/g, '/')

    // Find the matching directory pattern for this file
    let expectedNamespace = null
    let matchedDirectory = null
    for (const [dirPattern, namespace] of Object.entries(namespaceMap)) {
      const normalizedPattern = dirPattern.replace(/\\/g, '/')
      if (filePath.includes(normalizedPattern + '/') || filePath.includes(normalizedPattern + '\\')) {
        expectedNamespace = namespace
        matchedDirectory = dirPattern
        break
      }
    }

    // If this file isn't in a mapped directory, skip it
    if (!expectedNamespace) {
      return {}
    }

    return {
      CallExpression(node) {
        // Check for useTranslation() calls
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'useTranslation'
        ) {
          const firstArg = node.arguments[0]

          if (!firstArg) {
            // useTranslation() with no arguments
            context.report({
              node,
              messageId: 'missingNamespace',
              data: {
                directory: matchedDirectory,
                expected: expectedNamespace,
              },
            })
          } else if (
            firstArg.type === 'Literal' &&
            typeof firstArg.value === 'string' &&
            firstArg.value !== expectedNamespace
          ) {
            // useTranslation('wrong-namespace')
            context.report({
              node,
              messageId: 'wrongNamespace',
              data: {
                actual: firstArg.value,
                directory: matchedDirectory,
                expected: expectedNamespace,
              },
            })
          }
          // If the argument matches the expected namespace, no error
        }
      },
    }
  },
}

export default rule
