import { DonnaHealthResponseSchema } from '@donna/api-contract'
import { Hono } from 'hono'
import { useWorkersLogger } from 'workers-tagged-logger'

import { withDefaultCors, withNotFound, withOnError } from '@repo/hono-helpers'

import type { App } from './context'

const donnaApi = new Hono<App>()
	.use('*', (c, next) =>
		useWorkersLogger(c.env.NAME, {
			environment: c.env.ENVIRONMENT,
			release: c.env.RELEASE,
		})(c, next)
	)
	.use('*', withDefaultCors())
	.onError(withOnError())
	.notFound(withNotFound())

	.get('/v1/health', (c) =>
		c.json(
			DonnaHealthResponseSchema.parse({
				status: 'ok',
				service: 'donna-api',
			})
		)
	)

export default donnaApi
