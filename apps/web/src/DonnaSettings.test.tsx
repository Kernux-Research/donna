import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { DonnaSettings } from './DonnaSettings'

afterEach(() => {
	cleanup()
	vi.unstubAllGlobals()
})

it('saves model settings without displaying or reading back the provider key', async () => {
	let saved = false
	const fetchMock = vi.fn().mockImplementation((_path: string, init?: RequestInit) => {
		if (init?.method === 'PUT') {
			saved = true
			return Response.json({
				baseUrl: 'https://provider.example/v1',
				model: 'test-model',
				hasApiKey: true,
			})
		}
		return Response.json({
			baseUrl: saved ? 'https://provider.example/v1' : '',
			model: saved ? 'test-model' : '',
			hasApiKey: saved,
		})
	})
	vi.stubGlobal('fetch', fetchMock)
	const view = render(<DonnaSettings />)
	await screen.findByText('An API key is required before Donna can reply.')
	fireEvent.change(screen.getByLabelText('API base URL'), {
		target: { value: 'https://provider.example/v1' },
	})
	fireEvent.change(screen.getByLabelText('Model ID'), { target: { value: 'test-model' } })
	fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'user-secret-value' } })
	fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
	await screen.findByText('Model settings saved')
	const put: RequestInit = fetchMock.mock.calls.find(([_path, init]) => init?.method === 'PUT')![1]
	expect(put.body).toContain('"apiKey":"user-secret-value"')
	expect(screen.queryByText('user-secret-value')).toBeNull()
	expect(screen.getByLabelText('API key')).toHaveProperty('value', '')
	view.unmount()
	render(<DonnaSettings />)
	await waitFor(() =>
		expect(
			screen.getByText('A key is saved for your account. Enter a new one only to replace it.')
		).toBeTruthy()
	)
	expect(fetchMock.mock.calls.filter(([_path, init]) => !init)).toHaveLength(2)
})
