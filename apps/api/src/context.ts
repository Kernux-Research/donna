import type { HonoApp } from '@repo/hono-helpers'
import type { SharedHonoEnv, SharedHonoVariables } from '@repo/hono-helpers/src/types'

export type Env = SharedHonoEnv & {
	DONNA_THREADS: DurableObjectNamespace
	DONNA_API_TOKEN: string
	DONNA_WEB_ORIGIN: string
	ACCESS_TEAM_DOMAIN: string
	ACCESS_AUD: string
	DONNA_OWNER_EMAIL: string
	SETTINGS_ENCRYPTION_KEY: string
	OPENAI_BASE_URL: string
	OPENAI_API_KEY: string
	OPENAI_MODEL: string
}

/** Variables can be extended */
export type Variables = SharedHonoVariables & { userId: string }

export interface App extends HonoApp {
	Bindings: Env
	Variables: Variables
}
