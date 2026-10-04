import * as z from 'zod'

const ChunkSchema = z.object({
	choices: z.array(z.object({ delta: z.object({ content: z.string().nullable().optional() }) })),
})

/** The only system instruction sent to the configured model. No external tools are available. */
export const DONNA_SYSTEM_INSTRUCTION =
	'You are Donna, a personal agent. Be concise and direct. You have no external-service capabilities. Never claim to have performed an external action. If a task requires an external service, explain that a Gatekeeper capability is not yet available.'

/** Stream text deltas from the deployer's OpenAI-compatible chat completions endpoint. */
export async function* streamOpenAiCompatibleResponse(
	config: { baseUrl: string; apiKey: string; model: string },
	messages: Array<{ role: 'user' | 'assistant'; content: string }>,
	signal?: AbortSignal
): AsyncGenerator<string> {
	const base = new URL(config.baseUrl)
	if (
		base.protocol !== 'https:' &&
		!(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))
	) {
		throw new Error('inference_configuration_invalid')
	}
	const url = new URL(`${base.pathname.replace(/\/$/, '')}/chat/completions`, base)
	const response = await fetch(url, {
		method: 'POST',
		headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: config.model,
			stream: true,
			messages: [{ role: 'system', content: DONNA_SYSTEM_INSTRUCTION }, ...messages],
		}),
		signal,
	})
	if (!response.ok) {
		throw new Error(
			response.status === 401 || response.status === 403
				? 'inference_auth_failed'
				: response.status === 429
					? 'inference_rate_limited'
					: 'inference_failed'
		)
	}
	if (!response.body) throw new Error('inference_failed')

	const reader = response.body.getReader()
	const decoder = new TextDecoder()
	let buffer = ''
	let completed = false
	try {
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
				if (data === '[DONE]') {
					completed = true
					break
				}
				const chunk = ChunkSchema.safeParse(JSON.parse(data))
				if (!chunk.success) throw new Error('inference_stream_invalid')
				for (const choice of chunk.data.choices)
					if (choice.delta.content) yield choice.delta.content
			}
			if (completed || done) break
		}
	} finally {
		await reader.cancel()
	}
	if (!completed) throw new Error('inference_stream_interrupted')
}
