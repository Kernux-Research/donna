import {
	ApiErrorSchema,
	ModelSettingsResponseSchema,
	PutModelSettingsRequestSchema,
} from '@donna/api-contract'

import type { ModelSettingsResponse, PutModelSettingsRequest } from '@donna/api-contract'

async function modelSettingsRequest(init?: RequestInit): Promise<ModelSettingsResponse> {
	const response = await fetch('/api/v1/settings/model', init)
	if (!response.ok) {
		const failure = ApiErrorSchema.safeParse(await response.json().catch(() => null))
		throw new Error(failure.success ? failure.data.code : `request_failed_${response.status}`)
	}
	return ModelSettingsResponseSchema.parse(await response.json())
}

/** Load the current user's model endpoint and model without returning their API key. */
export function getDonnaModelSettings(): Promise<ModelSettingsResponse> {
	return modelSettingsRequest()
}

/** Save the current user's model API key server-side; the response never includes it. */
export function putDonnaModelSettings(
	settings: PutModelSettingsRequest
): Promise<ModelSettingsResponse> {
	return modelSettingsRequest({
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(PutModelSettingsRequestSchema.parse(settings)),
	})
}
