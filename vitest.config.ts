import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'jsdom',
		include: ['scripts/vulnerability-testing/**/*.vulnerability-test.{ts,tsx}'],
		setupFiles: ['scripts/vulnerability-testing/vitest-setup.ts'],
	},
})
