import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config([
  eslint.configs.recommended,

  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,js,mjs}'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/.yarn/**', '**/.pnp.cjs', '**/.pnp.loader.mjs', '**/node_modules/**'],
  },

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        parser: tseslint.parser,
        sourceType: 'module'
      }
    }
  },

  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
])
