import * as z from 'zod'

/** Thread ID assigned by the Donna API. */
export const ThreadIdSchema = z.uuid().brand<'ThreadId'>()
/** Message ID assigned by the Donna API. */
export const MessageIdSchema = z.uuid().brand<'MessageId'>()
/** Stored conversation message, including failed generations. */
export const DonnaMessageSchema = z.object({
	id: MessageIdSchema,
	threadId: ThreadIdSchema,
	role: z.enum(['user', 'assistant']),
	content: z.string(),
	createdAt: z.string(),
	status: z.enum(['completed', 'failed']),
})
/** Persisted thread summary. */
export const DonnaThreadSchema = z.object({
	id: ThreadIdSchema,
	title: z.string().trim().min(1).max(100).default('New chat'),
	kind: z.enum(['main', 'side']).default('side'),
	createdAt: z.string(),
	updatedAt: z.string(),
})
/** Empty create thread request. */
export const CreateThreadRequestSchema = z.object({}).strict()
/** Create thread response. */
export const CreateThreadResponseSchema = z.object({ thread: DonnaThreadSchema })
/** Rename a saved conversation. */
export const UpdateThreadRequestSchema = z.object({ title: z.string().trim().min(1).max(100) })
/** Rename thread response. */
export const UpdateThreadResponseSchema = z.object({ thread: DonnaThreadSchema })
/** List threads response. */
export const ListThreadsResponseSchema = z.object({ threads: z.array(DonnaThreadSchema) })
/** Get thread and messages response. */
export const GetThreadResponseSchema = z.object({
	thread: DonnaThreadSchema,
	messages: z.array(DonnaMessageSchema),
})
/** Send a text message to a thread. */
export const SendMessageRequestSchema = z.object({ content: z.string().trim().min(1).max(32000) })
/** Server-sent event payload for message generation. */
export const AgentStreamEventSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('message.started'), messageId: MessageIdSchema }),
	z.object({ type: z.literal('message.delta'), content: z.string() }),
	z.object({ type: z.literal('message.completed'), message: DonnaMessageSchema }),
	z.object({ type: z.literal('message.failed'), code: z.string() }),
])
/** Stable API failure payload. */
export const ApiErrorSchema = z.object({ code: z.string(), message: z.string() })

export type ThreadId = z.infer<typeof ThreadIdSchema>
export type MessageId = z.infer<typeof MessageIdSchema>
export type DonnaMessage = z.infer<typeof DonnaMessageSchema>
export type DonnaThread = z.infer<typeof DonnaThreadSchema>
export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>
export type GetThreadResponse = z.infer<typeof GetThreadResponseSchema>
export type ListThreadsResponse = z.infer<typeof ListThreadsResponseSchema>
