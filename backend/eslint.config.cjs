const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', 'artifacts/**', 'sessions/**', 'logs/**', 'data/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module', // Оставляем module, т.к. ESLint может анализировать ES модули
      globals: {
        ...globals.node,
        ...globals.es2021,
        // Для тестов Mocha
        describe: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        before: 'readonly',
        after: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn', // Лучше warn, чем off
      'no-console': 'off', // Оставляем off для логов в Node.js
      'no-undef': 'error',
      'no-duplicate-imports': 'error',
    },
  },
]; 