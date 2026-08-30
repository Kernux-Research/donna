import { useEffect, useState } from 'react'

import { fetchDonnaHealth } from './donna-health-client'

import './styles.css'

type DonnaConnectionState =
	| { status: 'checking' }
	| { status: 'connected' }
	| { status: 'unavailable' }

const donnaApiBaseUrl = import.meta.env.VITE_DONNA_API_BASE_URL ?? 'http://localhost:8787'

/** Render Donna's first-party client and current API connection state. */
export function DonnaApp() {
	const [connectionState, setConnectionState] = useState<DonnaConnectionState>({
		status: 'checking',
	})

	useEffect(() => {
		void fetchDonnaHealth(donnaApiBaseUrl).then(
			() => setConnectionState({ status: 'connected' }),
			() => setConnectionState({ status: 'unavailable' })
		)
	}, [])

	return (
		<main className="donna-shell">
			<section className="donna-card" aria-labelledby="donna-title">
				<p className="donna-eyebrow">Personal agent</p>
				<h1 id="donna-title">Donna</h1>
				<p className="donna-description">
					A headless personal agent with capability-based access to your services.
				</p>
				<div className={`donna-status donna-status-${connectionState.status}`} role="status">
					<span className="donna-status-dot" aria-hidden="true" />
					{connectionState.status === 'checking' && 'Checking API connection'}
					{connectionState.status === 'connected' && 'API connected'}
					{connectionState.status === 'unavailable' && 'API unavailable'}
				</div>
			</section>
		</main>
	)
}
