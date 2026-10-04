import {
	AgentStreamEventSchema,
	ApiErrorSchema,
	CreateThreadResponseSchema,
	GetThreadResponseSchema,
	ListThreadsResponseSchema,
	UpdateThreadResponseSchema,
} from '@donna/api-contract'

import type {
	AgentStreamEvent,
	DonnaThread,
	GetThreadResponse,
	ListThreadsResponse,
	ThreadId,
} from '@donna/api-contract'

async function donnaRequest(path: string, init?: RequestInit): Promise<Response> {
	const response = await fetch(`/api${path}`, init)
	if (!response.ok) {
		const payload = ApiErrorSchema.safeParse(await response.json().catch(() => null))
		throw new Error(payload.success ? payload.data.code : `request_failed_${response.status}`)
	}
	return response
}

/** List saved threads through the same-origin web Worker proxy. */
export async function listDonnaThreads(): Promise<ListThreadsResponse> {
	return ListThreadsResponseSchema.parse(await (await donnaRequest('/v1/threads')).json())
}

/** Get or create the one persistent main chat through the same-origin web Worker. */
export async function getDonnaMainThread(): Promise<DonnaThread> {
	return CreateThreadResponseSchema.parse(await (await donnaRequest('/v1/threads/main')).json())
		.thread
}

/** Create an empty side chat. */
export async function createDonnaThread(): Promise<ThreadId> {
	const response = CreateThreadResponseSchema.parse(
		await (await donnaRequest('/v1/threads', { method: 'POST' })).json()
	)
	return response.thread.id
}

/** Load persisted messages for a thread. */
export async function getDonnaThread(id: ThreadId): Promise<GetThreadResponse> {
	return GetThreadResponseSchema.parse(await (await donnaRequest(`/v1/threads/${id}`)).json())
}

/** Rename a conversation through the same-origin web Worker. */
export async function renameDonnaThread(id: ThreadId, title: string): Promise<DonnaThread> {
	const response = await donnaRequest(`/v1/threads/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ title }),
	})
	return UpdateThreadResponseSchema.parse(await response.json()).thread
}

/** Permanently delete a conversation through the same-origin web Worker. */
export async function deleteDonnaThread(id: ThreadId): Promise<void> {
	await donnaRequest(`/v1/threads/${id}`, { method: 'DELETE' })
}

/** Read complete SSE frames and validate streamed agent events. */
export async function sendDonnaMessage(
	id: ThreadId,
	content: string,
	onEvent: (event: AgentStreamEvent) => void
): Promise<void> {
	const response = await donnaRequest(`/v1/threads/${id}/messages`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ content }),
	})
	if (!response.body) throw new Error('stream_interrupted')
	const reader = response.body.getReader()
	const decoder = new TextDecoder()
	let buffer = ''
	let terminal = false
	while (true) {
		const { done, value } = await reader.read()
		buffer += decoder.decode(value, { stream: !done })
		const frames = buffer.split(/\r?\n\r?\n/)
		buffer = frames.pop() ?? ''
		for (const frame of frames) {
			const data = frame
				.split(/\r?\n/)
				.filter((line) => line.startsWith('data:'))
				.map((line) => line.slice(5).trim())
				.join('\n')
			if (!data) continue
			const event = AgentStreamEventSchema.parse(JSON.parse(data))
			onEvent(event)
			if (event.type === 'message.completed' || event.type === 'message.failed') terminal = true
		}
		if (done) break
	}
	if (!terminal) throw new Error('stream_interrupted')
}
