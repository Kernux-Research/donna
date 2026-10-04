import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { getDonnaModelSettings, putDonnaModelSettings } from './donna-model-settings-client'

import type { PutModelSettingsRequest } from '@donna/api-contract'

/** Let an authenticated user update their own model settings without reading back their API key. */
export function DonnaSettings() {
	const [baseUrl, setBaseUrl] = useState('')
	const [model, setModel] = useState('')
	const [apiKey, setApiKey] = useState('')
	const [hasApiKey, setHasApiKey] = useState(false)
	const [pending, setPending] = useState(false)
	const [notice, setNotice] = useState('')

	useEffect(() => {
		void getDonnaModelSettings()
			.then((settings) => {
				setBaseUrl(settings.baseUrl)
				setModel(settings.model)
				setHasApiKey(settings.hasApiKey)
			})
			.catch(() => setNotice('Unable to load model settings'))
	}, [])

	async function saveSettings(event: React.FormEvent) {
		event.preventDefault()
		setPending(true)
		setNotice('')
		try {
			const input: PutModelSettingsRequest = { baseUrl: baseUrl.trim(), model: model.trim() }
			if (apiKey.trim()) input.apiKey = apiKey.trim()
			const saved = await putDonnaModelSettings(input)
			setHasApiKey(saved.hasApiKey)
			setApiKey('')
			setNotice('Model settings saved')
		} catch {
			setNotice('Unable to save model settings. Check the URL, model, and API key.')
		} finally {
			setPending(false)
		}
	}

	return (
		<section className="settings-page" aria-label="Model settings">
			<div className="settings-card">
				<h1>Model settings</h1>
				<p>
					Connect your own OpenAI-compatible model. Your key is stored encrypted on the server and
					is never shown again.
				</p>
				<form onSubmit={(event) => void saveSettings(event)}>
					<label htmlFor="model-base-url">API base URL</label>
					<Input
						id="model-base-url"
						type="url"
						required
						placeholder="https://provider.example/v1"
						value={baseUrl}
						onChange={(event) => setBaseUrl(event.target.value)}
					/>
					<label htmlFor="model-name">Model ID</label>
					<Input
						id="model-name"
						required
						maxLength={200}
						placeholder="Your provider's model ID"
						value={model}
						onChange={(event) => setModel(event.target.value)}
					/>
					<label htmlFor="model-api-key">API key</label>
					<Input
						id="model-api-key"
						type="password"
						autoComplete="off"
						required={!hasApiKey}
						placeholder={hasApiKey ? 'Leave blank to keep your current key' : 'Enter your API key'}
						value={apiKey}
						onChange={(event) => setApiKey(event.target.value)}
					/>
					<p className="settings-hint">
						{hasApiKey
							? 'A key is saved for your account. Enter a new one only to replace it.'
							: 'An API key is required before Donna can reply.'}
					</p>
					<Button type="submit" disabled={pending}>
						{pending ? 'Saving…' : 'Save settings'}
					</Button>
				</form>
				{notice && (
					<p role="status" className="settings-notice">
						{notice}
					</p>
				)}
			</div>
		</section>
	)
}
