import { DonnaHealthResponseSchema } from '@donna/api-contract'

import type { DonnaHealthResponse } from '@donna/api-contract'

/** Fetch and validate Donna API health from the configured API origin. */
export async function fetchDonnaHealth(apiBaseUrl: string): Promise<DonnaHealthResponse> {
	const healthUrl = new URL('/v1/health', apiBaseUrl)
	const response = await fetch(healthUrl)

	if (!response.ok) {
		throw new Error(`Donna API health request failed with status ${response.status}`)
	}

	return DonnaHealthResponseSchema.parse(await response.json())
}
