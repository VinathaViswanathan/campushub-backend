// ESLint flat config (ESLint 9+/10) for the backend: src/, scripts/, shared/, and config files.
// The React client in client/ has its own toolchain and is out of scope here.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/', 'coverage/', 'logs/', 'client/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // Allow intentionally unused names when prefixed with _, e.g. Express's (err, _req, res, _next).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
);
