import { afterEach, expect, it, vi } from 'vitest'
import * as z from 'zod'

import {
	DONNA_SYSTEM_INSTRUCTION,
	streamOpenAiCompatibleResponse,
} from './openai-compatible-inference'

const config = { baseUrl: 'https://model.example/v1', apiKey: 'test-key', model: 'test-model' }
afterEach(() => vi.unstubAllGlobals())

it('sends configured credentials and streams OpenAI chat completion deltas', async () => {
	const fetchMock = vi
		.fn()
		.mockResolvedValue(
			new Response(
				[
					'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
					'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
					'data: [DONE]\n\n',
				].join(''),
				{ headers: { 'Content-Type': 'text/event-stream' } }
			)
		)
	vi.stubGlobal('fetch', fetchMock)
	const deltas = []
	for await (const delta of streamOpenAiCompatibleResponse(config, [
		{ role: 'user', content: 'Hi' },
	]))
		deltas.push(delta)
	expect(deltas).toEqual(['Hello', ' world'])
	expect(String(fetchMock.mock.calls[0]![0])).toBe('https://model.example/v1/chat/completions')
	expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer test-key')
	const body = JSON.parse(z.string().parse(fetchMock.mock.calls[0]![1].body))
	expect(body).toEqual({
		model: 'test-model',
		stream: true,
		messages: [
			{ role: 'system', content: DONNA_SYSTEM_INSTRUCTION },
			{ role: 'user', content: 'Hi' },
		],
	})
})

it('rejects insecure remote endpoints and truncated streams', async () => {
	await expect(async () => {
		for await (const delta of streamOpenAiCompatibleResponse(
			{ ...config, baseUrl: 'http://model.example/v1' },
			[]
		))
			void delta
	}).rejects.toThrow('inference_configuration_invalid')
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('data: {"choices":[]}\n\n')))
	await expect(async () => {
		for await (const delta of streamOpenAiCompatibleResponse(config, [])) void delta
	}).rejects.toThrow('inference_stream_interrupted')
})
