import { DonnaMessageSchema } from '@donna/api-contract'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { DonnaMessage } from './DonnaMessage'

it('renders Markdown as text and copies the original message', async () => {
	const content = '**Hello** `world` <script>alert(1)</script>'
	const message = DonnaMessageSchema.parse({
		id: 'aa32cfc0-6d03-41ed-8b5f-5640b42f6633',
		threadId: '42c0ca61-c20c-487b-95df-2bfb93c4b797',
		role: 'assistant',
		content,
		createdAt: '2026-01-01T00:00:00Z',
		status: 'completed',
	})
	const writeText = vi.fn().mockResolvedValue(undefined)
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
	const { container } = render(<DonnaMessage message={message} />)
	expect(screen.getByText('Hello').tagName).toBe('STRONG')
	expect(screen.getByText('world').tagName).toBe('CODE')
	expect(container.querySelector('script')).toBeNull()
	fireEvent.click(screen.getByRole('button', { name: 'Copy assistant message' }))
	await waitFor(() => expect(writeText).toHaveBeenCalledWith(content))
})
