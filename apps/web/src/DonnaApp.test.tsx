import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { DonnaApp } from './DonnaApp'

const main = {
	id: 'c41a978e-51a3-44da-a3c2-fd2b0cdb7ef9',
	title: 'Main',
	kind: 'main',
	createdAt: '2026-01-01T00:00:00Z',
	updatedAt: '2026-01-01T00:00:00Z',
}
const thread = {
	id: '42c0ca61-c20c-487b-95df-2bfb93c4b797',
	title: 'New chat',
	kind: 'side',
	createdAt: '2026-01-01T00:00:00Z',
	updatedAt: '2026-01-01T00:00:00Z',
}
const assistant = {
	id: 'aa32cfc0-6d03-41ed-8b5f-5640b42f6633',
	threadId: thread.id,
	role: 'assistant',
	content: 'Hello!',
	status: 'completed',
	createdAt: '2026-01-01T00:00:00Z',
}

afterEach(() => {
	cleanup()
	vi.unstubAllGlobals()
	sessionStorage.clear()
})

it('opens main by default, creates a side chat, and keeps its history after reload', async () => {
	let created = false
	let messages: Array<typeof assistant> = []
	const fetchMock = vi.fn().mockImplementation((path: string, init?: RequestInit) => {
		if (path === '/api/v1/threads/main') return Response.json({ thread: main })
		if (path === '/api/v1/threads' && init?.method === 'POST') {
			created = true
			return Response.json({ thread })
		}
		if (path === '/api/v1/threads')
			return Response.json({ threads: created ? [main, thread] : [main] })
		if (path.endsWith('/messages')) {
			messages = [
				{ ...assistant, id: '52c0ca61-c20c-487b-95df-2bfb93c4b797', role: 'user', content: 'Hi' },
				assistant,
			]
			return new Response(
				`data: ${JSON.stringify({ type: 'message.started', messageId: assistant.id })}\n\ndata: ${JSON.stringify({ type: 'message.delta', content: 'Hello!' })}\n\ndata: ${JSON.stringify({ type: 'message.completed', message: assistant })}\n\n`
			)
		}
		return Response.json({
			thread: path.endsWith(main.id) ? main : thread,
			messages: path.endsWith(main.id) ? [] : messages,
		})
	})
	vi.stubGlobal('fetch', fetchMock)
	const view = render(<DonnaApp />)
	await screen.findByRole('heading', { name: 'Your main chat' })
	expect(screen.queryByLabelText('API token')).toBeNull()
	fireEvent.click(
		within(screen.getByRole('complementary', { name: 'Conversations' })).getByRole('button', {
			name: 'New side chat',
		})
	)
	await screen.findByRole('heading', { name: 'A new side chat' })
	fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hi' } })
	fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Enter', shiftKey: true })
	expect(fetchMock.mock.calls.some(([path]) => String(path).endsWith('/messages'))).toBe(false)
	fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Enter' })
	await screen.findByText('Hello!')
	view.unmount()
	render(<DonnaApp />)
	await screen.findByRole('heading', { name: 'Your main chat' })
	fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
	await screen.findByText('Hello!')
})

it('opens model settings and sends from main without creating a side chat', async () => {
	const fetchMock = vi.fn().mockImplementation((path: string) => {
		if (path === '/api/v1/settings/model')
			return Response.json({ baseUrl: '', model: '', hasApiKey: false })
		if (path === '/api/v1/threads/main') return Response.json({ thread: main })
		if (path === '/api/v1/threads') return Response.json({ threads: [main] })
		if (path.endsWith('/messages'))
			return new Response(
				`data: ${JSON.stringify({ type: 'message.failed', code: 'inference_failed' })}\n\n`
			)
		return Response.json({ thread: main, messages: [] })
	})
	vi.stubGlobal('fetch', fetchMock)
	render(<DonnaApp />)
	await screen.findByRole('heading', { name: 'Your main chat' })
	fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
	await screen.findByRole('heading', { name: 'Model settings' })
	fireEvent.click(screen.getByRole('button', { name: 'Main chat' }))
	fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Plan a trip' } })
	fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Enter' })
	await waitFor(() =>
		expect(
			fetchMock.mock.calls.some(([path]) => String(path).endsWith(`/${main.id}/messages`))
		).toBe(true)
	)
	expect(
		fetchMock.mock.calls.some(
			([path, init]) => path === '/api/v1/threads' && init?.method === 'POST'
		)
	).toBe(false)
})
