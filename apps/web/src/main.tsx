import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { DonnaApp } from './DonnaApp'

const rootElement = document.querySelector('#root')

if (rootElement === null) {
	throw new Error('Donna web root element was not found')
}

createRoot(rootElement).render(
	<StrictMode>
		<DonnaApp />
	</StrictMode>
)
