import { MessageIdSchema } from '@donna/api-contract'
import { ArrowUp, Menu, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import {
	createDonnaThread,
	deleteDonnaThread,
	getDonnaMainThread,
	getDonnaThread,
	listDonnaThreads,
	renameDonnaThread,
	sendDonnaMessage,
} from './donna-conversation-client'
import { DonnaMessage } from './DonnaMessage'
import { DonnaSettings } from './DonnaSettings'
import { DonnaSidebar } from './DonnaSidebar'

import type { DonnaMessage as DonnaMessageData, DonnaThread, ThreadId } from '@donna/api-contract'

import './styles.css'

/** Render Donna's chat workspace; the web Worker handles authentication and API proxying. */
export function DonnaApp() {
	const [threads, setThreads] = useState<DonnaThread[]>([])
	const [mainThread, setMainThread] = useState<DonnaThread | null>(null)
	const [selected, setSelected] = useState<ThreadId | null>(null)
	const [messages, setMessages] = useState<DonnaMessageData[]>([])
	const [draft, setDraft] = useState('')
	const [streaming, setStreaming] = useState('')
	const [busy, setBusy] = useState(false)
	const [notice, setNotice] = useState('')
	const [sidebarOpen, setSidebarOpen] = useState(false)
	const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat')
	const messagesEnd = useRef<HTMLDivElement>(null)

	useEffect(() => {
		sessionStorage.removeItem('donna-api-token')
		void getDonnaMainThread()
			.then(async (main) => {
				setMainThread(main)
				setSelected(main.id)
				setThreads((await listDonnaThreads()).threads)
			})
			.catch(() => setNotice('Unable to load main chat'))
	}, [])

	useEffect(() => {
		if (!selected || busy) return
		let active = true
		void getDonnaThread(selected)
			.then(({ messages }) => {
				if (active) setMessages(messages)
			})
			.catch(() => {
				if (active) setNotice('Unable to load chat')
			})
		return () => {
			active = false
		}
	}, [selected, busy])

	useEffect(() => {
		messagesEnd.current?.scrollIntoView?.({ behavior: 'smooth' })
	}, [messages, streaming])

	async function createThread() {
		try {
			const id = await createDonnaThread()
			setThreads((await listDonnaThreads()).threads)
			setMessages([])
			setSelected(id)
			setActiveTab('chat')
			setSidebarOpen(false)
			setNotice('')
			return id
		} catch {
			setNotice('Unable to create chat')
		}
	}

	function selectThread(id: ThreadId) {
		setMessages([])
		setSelected(id)
		setActiveTab('chat')
		setSidebarOpen(false)
		setNotice('')
	}

	async function renameThread(id: ThreadId, title: string) {
		try {
			const updated = await renameDonnaThread(id, title)
			setThreads((current) => current.map((thread) => (thread.id === id ? updated : thread)))
			setNotice('')
		} catch {
			setNotice('Unable to rename chat')
		}
	}

	async function deleteThread(id: ThreadId) {
		try {
			await deleteDonnaThread(id)
			const remaining = threads.filter((thread) => thread.id !== id)
			setThreads(remaining)
			if (selected === id) {
				setSelected(mainThread?.id ?? null)
				setMessages([])
			}
			setNotice('')
		} catch {
			setNotice('Unable to delete chat')
		}
	}

	async function sendMessage(event: React.FormEvent) {
		event.preventDefault()
		if (!selected || !draft.trim() || busy) return
		const content = draft.trim()
		const id = selected
		setBusy(true)
		setDraft('')
		setNotice('')
		setMessages((current) => [
			...current,
			{
				id: MessageIdSchema.parse(crypto.randomUUID()),
				threadId: id,
				role: 'user',
				content,
				createdAt: new Date().toISOString(),
				status: 'completed',
			},
		])
		try {
			await sendDonnaMessage(id, content, (update) => {
				if (update.type === 'message.delta') setStreaming((current) => current + update.content)
				if (update.type === 'message.completed') {
					setMessages((current) => [...current, update.message])
					setStreaming('')
				}
				if (update.type === 'message.failed') setNotice(update.code)
			})
			setMessages((await getDonnaThread(id)).messages)
			setThreads((await listDonnaThreads()).threads)
		} catch (err) {
			setNotice(err instanceof Error ? err.message : 'Message failed')
		} finally {
			setBusy(false)
			setStreaming('')
		}
	}

	return (
		<main className="chat-layout">
			<DonnaSidebar
				mainThread={mainThread}
				activeTab={activeTab}
				threads={threads}
				selected={selected}
				busy={busy}
				open={sidebarOpen}
				onCreate={() => void createThread()}
				onClose={() => setSidebarOpen(false)}
				onSettings={() => {
					setActiveTab('settings')
					setSidebarOpen(false)
				}}
				onSelect={selectThread}
				onRename={renameThread}
				onDelete={deleteThread}
			/>
			<section className="chat-main" aria-label="Conversation">
				<header className="chat-header">
					<Button
						variant="ghost"
						size="icon"
						className="menu-button"
						onClick={() => setSidebarOpen(!sidebarOpen)}
						aria-label="Toggle conversations"
						aria-expanded={sidebarOpen}
					>
						<Menu size={20} />
					</Button>
					<div className="header-identity">
						<span className="header-title">
							{activeTab === 'settings'
								? 'Settings'
								: selected === mainThread?.id
									? 'Main chat'
									: (threads.find((thread) => thread.id === selected)?.title ?? 'Donna')}
						</span>
						<span className="header-subtitle">Donna</span>
					</div>
					{activeTab === 'chat' && (
						<Button
							variant="ghost"
							size="icon"
							className="header-new-chat"
							disabled={busy || !mainThread}
							aria-label="New side chat"
							onClick={() => void createThread()}
						>
							<Plus size={20} />
						</Button>
					)}
				</header>
				{activeTab === 'settings' ? (
					<DonnaSettings />
				) : (
					<>
						<div
							className={`chat-messages ${messages.length === 0 && !busy ? 'is-empty' : ''}`}
							role="log"
							aria-live="polite"
						>
							{messages.length === 0 && !busy && (
								<div className="chat-welcome">
									<span className="welcome-mark" aria-hidden="true">
										d
									</span>
									<h1>{selected === mainThread?.id ? 'Your main chat' : 'A new side chat'}</h1>
									<p>{selected ? 'What’s on your mind?' : 'Loading your main chat…'}</p>
								</div>
							)}
							{messages.map((message) => (
								<DonnaMessage key={message.id} message={message} />
							))}
							{busy && (
								<article className="chat-message assistant">
									<div className="message-avatar" aria-hidden="true">
										d
									</div>
									<div className="message-body">
										<div className="message-author">Donna</div>
										<p className="streaming-text">{streaming || 'Thinking…'}</p>
									</div>
								</article>
							)}
							<div ref={messagesEnd} />
						</div>
						{notice && (
							<p className="chat-notice" role="alert">
								{notice}
							</p>
						)}
						<div className="composer-area">
							<form className="chat-composer" onSubmit={(event) => void sendMessage(event)}>
								<label htmlFor="message">Message</label>
								<Textarea
									id="message"
									value={draft}
									placeholder="Message Donna…"
									onChange={(event) => setDraft(event.target.value)}
									onKeyDown={(event) => {
										if (
											event.key === 'Enter' &&
											!event.shiftKey &&
											!event.nativeEvent.isComposing
										) {
											event.preventDefault()
											event.currentTarget.form?.requestSubmit()
										}
									}}
									disabled={busy || !mainThread}
									rows={2}
								/>
								<Button
									type="submit"
									size="icon"
									disabled={busy || !selected || !draft.trim()}
									aria-label="Send message"
								>
									<ArrowUp size={19} />
								</Button>
							</form>
						</div>
					</>
				)}
			</section>
		</main>
	)
}
