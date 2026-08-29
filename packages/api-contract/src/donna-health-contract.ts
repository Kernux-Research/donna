import * as z from 'zod'

/** Describes the operational state returned by Donna's public health endpoint. */
export const DonnaHealthResponseSchema = z.object({
	status: z.literal('ok'),
	service: z.literal('donna-api'),
})

/** Response returned by Donna's public health endpoint. */
export type DonnaHealthResponse = z.infer<typeof DonnaHealthResponseSchema>
