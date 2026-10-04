import { randomBytes } from 'node:crypto'
import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [
		cloudflareTest({
			remoteBindings: false,
			wrangler: { configPath: `${__dirname}/wrangler.jsonc` },
			miniflare: {
				bindings: {
					ENVIRONMENT: 'VITEST',
					DONNA_API_TOKEN: 'test-token',
					DONNA_WEB_ORIGIN: 'https://web.donna.test',
					ACCESS_TEAM_DOMAIN: 'https://donna-test.cloudflareaccess.com',
					ACCESS_AUD: 'test-audience',
					DONNA_OWNER_EMAIL: 'owner@example.com',
					SETTINGS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
					OPENAI_BASE_URL: '',
					OPENAI_API_KEY: 'test-provider-key',
					OPENAI_MODEL: 'test-model',
				},
			},
		}),
	],
})
