import { HTTPException } from 'hono/http-exception'
import { httpStatus } from 'http-codex/status'

import { logger } from '../helpers/logger'

import type { Context } from 'hono'
import type { APIError } from '../helpers/errors'
import type { HonoApp } from '../types'

/** Handles typical onError hooks */
export function withOnError<T extends HonoApp>() {
	return async (err: Error, ctx: Context<T>): Promise<Response> => {
		if (err instanceof HTTPException) {
			const status = err.status
			const body: APIError = { success: false, error: { message: err.message } }
			if (status >= 500) {
				// TODO: Capture to Sentry here if you want Sentry
				logger.error(err)
			} else if (status === httpStatus.Unauthorized) {
				body.error.message = 'unauthorized'
			}

			return ctx.json(body, status)
		}

		// TODO: Capture to Sentry if you want Sentry
		logger.error(err)
		return ctx.json(
			{
				success: false,
				error: { message: 'internal server error' },
			} satisfies APIError,
			500
		)
	}
}
