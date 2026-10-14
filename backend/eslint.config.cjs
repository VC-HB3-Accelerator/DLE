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
  {
    files: ['services/**/*.js'],
    ignores: [
      'services/orchModelRouter.js',
      'services/aiProviderSettingsService.js',
      'services/qwenRealtimeService.js',
      'services/conferenceInterpretationAsr.js',
      'services/conferenceInterpretationTts.js',
      'services/whisperSttService.js',
      'services/voiceCallKnowledgeService.js',
      'services/conferenceTranslateService.js',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Literal[value=/^(?:qwen(?:-plus|-turbo|-max|-vl|3\\.|-image)|wan(?:2\\.|x)|deepseek-chat)[\\w.-]*$/]",
          message: 'W17: model-id только в orchModelRouter / Settings (см. t1 allowlist)',
        },
      ],
    },
  },
]; 