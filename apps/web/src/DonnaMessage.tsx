import { Copy } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

import { Button } from '@/components/ui/button'

import type { DonnaMessage as DonnaMessageData } from '@donna/api-contract'

/** Render a saved conversation message as safe Markdown with a copy action. */
export function DonnaMessage({ message }: { message: DonnaMessageData }) {
	const [copyStatus, setCopyStatus] = useState('Copy')

	async function copyMessage() {
		try {
			await navigator.clipboard.writeText(message.content)
			setCopyStatus('Copied')
		} catch {
			setCopyStatus('Copy unavailable')
		}
	}

	return (
		<article className={`chat-message ${message.role}`}>
			<div className="message-avatar" aria-hidden="true">
				{message.role === 'assistant' ? 'D' : 'You'}
			</div>
			<div className="message-body">
				<div className="message-author">{message.role === 'assistant' ? 'Donna' : 'You'}</div>
				{message.status === 'failed' ? (
					<p className="message-failed">Generation failed. You can send another message.</p>
				) : (
					<div className="message-content">
						<ReactMarkdown>{message.content}</ReactMarkdown>
					</div>
				)}
				{message.status === 'completed' && message.content && (
					<Button
						variant="ghost"
						size="xs"
						className="message-copy"
						aria-label={`Copy ${message.role} message`}
						onClick={() => void copyMessage()}
					>
						<Copy size={13} />
						{copyStatus}
					</Button>
				)}
			</div>
		</article>
	)
}
