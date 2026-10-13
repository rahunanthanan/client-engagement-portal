import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'public/mockServiceWorker.js'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Security: never render raw HTML and never log through console directly (use the redacting logger).
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Render user/server text as text. dangerouslySetInnerHTML is not allowed.',
        },
      ],
      'no-console': 'error',
      // With `noUncheckedIndexedAccess`, `!` after an explicit existence check is the clearest idiom.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Form values are records keyed by field id; deleting a key is how a hidden value is cleared.
      '@typescript-eslint/no-dynamic-delete': 'off',
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'e2e/**', '*.config.{js,ts}', 'scripts/**'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: { 'react-refresh/only-export-components': 'off', 'no-console': 'off' },
  },
  {
    // Route table: lazy() component declarations, not exports, so fast-refresh rules do not apply.
    files: ['src/app/routes.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['src/mocks/**', 'src/shared/logger.ts'],
    rules: { 'no-console': 'off' },
  },
);
