import { describe, expect, it } from 'vitest'

import {
	AgentStreamEventSchema,
	ApiErrorSchema,
	CreateThreadRequestSchema,
	DonnaMessageSchema,
	GetThreadResponseSchema,
	MessageIdSchema,
	SendMessageRequestSchema,
	ThreadIdSchema,
	UpdateThreadRequestSchema,
} from './donna-conversation-contract'

const threadId = '42c0ca61-c20c-487b-95df-2bfb93c4b797'
const messageId = 'aa32cfc0-6d03-41ed-8b5f-5640b42f6633'
const message = {
	id: messageId,
	threadId,
	role: 'assistant',
	content: 'Hello',
	status: 'completed',
	createdAt: '2026-01-01T00:00:00Z',
}

describe('Donna conversation schemas', () => {
	it('requires distinct valid identifiers and nonempty message content', () => {
		expect(ThreadIdSchema.safeParse(threadId).success).toBe(true)
		expect(MessageIdSchema.safeParse(messageId).success).toBe(true)
		expect(ThreadIdSchema.safeParse('not-an-id').success).toBe(false)
		expect(CreateThreadRequestSchema.safeParse({ extra: true }).success).toBe(false)
		expect(SendMessageRequestSchema.safeParse({ content: '  ' }).success).toBe(false)
		expect(DonnaMessageSchema.safeParse(message).success).toBe(true)
		expect(UpdateThreadRequestSchema.safeParse({ title: '  My chat  ' }).data?.title).toBe(
			'My chat'
		)
		expect(UpdateThreadRequestSchema.safeParse({ title: '  ' }).success).toBe(false)
		expect(
			GetThreadResponseSchema.safeParse({
				thread: { id: threadId, createdAt: message.createdAt, updatedAt: message.createdAt },
				messages: [message],
			}).success
		).toBe(true)
		expect(
			GetThreadResponseSchema.parse({
				thread: { id: threadId, createdAt: message.createdAt, updatedAt: message.createdAt },
				messages: [],
			}).thread.kind
		).toBe('side')
		expect(
			GetThreadResponseSchema.parse({
				thread: {
					id: threadId,
					kind: 'main',
					title: 'Main',
					createdAt: message.createdAt,
					updatedAt: message.createdAt,
				},
				messages: [],
			}).thread.kind
		).toBe('main')
	})

	it('validates all stream variants and public failures', () => {
		for (const event of [
			{ type: 'message.started', messageId },
			{ type: 'message.delta', content: 'Hi' },
			{ type: 'message.completed', message },
			{ type: 'message.failed', code: 'inference_failed' },
		])
			expect(AgentStreamEventSchema.safeParse(event).success).toBe(true)
		expect(AgentStreamEventSchema.safeParse({ type: 'message.completed' }).success).toBe(false)
		expect(
			ApiErrorSchema.safeParse({ code: 'invalid_request', message: 'Invalid request' }).success
		).toBe(true)
	})
})
