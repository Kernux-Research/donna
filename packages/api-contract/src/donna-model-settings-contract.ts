import * as z from 'zod'

/** Set an OpenAI-compatible endpoint and model; omit the key only when one is already saved. */
export const PutModelSettingsRequestSchema = z
	.object({
		baseUrl: z.url().refine((value) => {
			const url = new URL(value)
			return (
				(url.protocol === 'https:' ||
					(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) &&
				!url.username &&
				!url.password &&
				!url.search &&
				!url.hash
			)
		}),
		model: z.string().trim().min(1).max(200),
		apiKey: z.string().trim().min(1).max(4096).optional(),
	})
	.strict()

/** Read model settings without ever returning the stored provider API key. */
export const ModelSettingsResponseSchema = z.object({
	baseUrl: z.string(),
	model: z.string(),
	hasApiKey: z.boolean(),
})

export type PutModelSettingsRequest = z.infer<typeof PutModelSettingsRequestSchema>
export type ModelSettingsResponse = z.infer<typeof ModelSettingsResponseSchema>
