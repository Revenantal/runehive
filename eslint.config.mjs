import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const NEW_DATE = {
  selector: "NewExpression[callee.name='Date'][arguments.length=0]",
  message: 'Use the injected Clock.',
};
const PROCESS_ENV = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message: 'Read configuration only in the config module.',
};
const APP_SOURCE = ['packages/**/src/**/*.{ts,tsx,mjs}', 'apps/**/src/**/*.{ts,tsx,mjs}'];

export default defineConfig([
  { ignores: ['lostcity/**', 'node_modules/**', 'dist/**', 'docs/design/**/mockups/**'] },
  js.configs.recommended,
  { languageOptions: { globals: globals.node } },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.strict],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I[A-Z]', match: false },
        },
        { selector: 'enumMember', format: ['PascalCase'] },
        { selector: ['objectLiteralProperty', 'typeProperty', 'import'], format: null },
      ],
    },
  },
  {
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    // Named exports only. The ESLint config itself must default-export.
    files: ['tools/**', 'tests/**', 'packages/**', 'apps/**'],
    rules: {
      'no-restricted-exports': [
        'error',
        { restrictDefaultExports: { direct: true, named: true, defaultFrom: true } },
      ],
    },
  },
  {
    // Application code logs through the injected Logger and gets time, randomness, and IDs from
    // injected services, so it stays testable and deterministic.
    files: APP_SOURCE,
    ignores: ['**/*.test.*'],
    rules: {
      'no-console': 'error',
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Use the injected Clock.' },
        { object: 'Math', property: 'random', message: 'Use the injected Random.' },
        { object: 'crypto', property: 'randomUUID', message: 'Use the injected IdGenerator.' },
      ],
      'no-restricted-syntax': ['error', NEW_DATE, PROCESS_ENV],
    },
  },
  {
    // The config module is the one place allowed to read the environment.
    files: ['**/config.ts', '**/config/**'],
    rules: { 'no-restricted-syntax': ['error', NEW_DATE] },
  },
  {
    // Every function, method, and class in source needs a short description. Tests are exempt.
    files: ['tools/**/*.mjs', 'packages/**/*.{ts,tsx,mjs}', 'apps/**/*.{ts,tsx,mjs}'],
    ignores: ['**/*.test.*'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: false,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
        },
      ],
      'jsdoc/require-description': 'error',
      'jsdoc/check-alignment': 'error',
      'jsdoc/no-multi-asterisks': 'error',
    },
  },
]);
