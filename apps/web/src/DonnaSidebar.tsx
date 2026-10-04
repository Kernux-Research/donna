import { House, Menu, MessageCircle, Pencil, Plus, Search, Settings, Trash2 } from 'lucide-react'
import { useState } from 'react'

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { DonnaThread, ThreadId } from '@donna/api-contract'

interface DonnaSidebarProps {
	mainThread: DonnaThread | null
	activeTab: 'chat' | 'settings'
	threads: DonnaThread[]
	selected: ThreadId | null
	busy: boolean
	open: boolean
	onCreate: () => void
	onClose: () => void
	onSettings: () => void
	onSelect: (id: ThreadId) => void
	onRename: (id: ThreadId, title: string) => Promise<void>
	onDelete: (id: ThreadId) => Promise<void>
}

/** Pin the permanent main chat above searchable, editable side chats. */
export function DonnaSidebar({
	mainThread,
	activeTab,
	threads,
	selected,
	busy,
	open,
	onCreate,
	onClose,
	onSettings,
	onSelect,
	onRename,
	onDelete,
}: DonnaSidebarProps) {
	const [search, setSearch] = useState('')
	const [editing, setEditing] = useState<ThreadId | null>(null)
	const [titleDraft, setTitleDraft] = useState('')
	const [deleting, setDeleting] = useState<DonnaThread | null>(null)
	const visible = threads.filter(
		(thread) =>
			thread.kind === 'side' && thread.title.toLowerCase().includes(search.toLowerCase().trim())
	)

	return (
		<>
			{open && (
				<button className="sidebar-scrim" aria-label="Close conversations" onClick={onClose} />
			)}
			<aside className={`chat-sidebar ${open ? 'open' : ''}`} aria-label="Conversations">
				<div className="sidebar-brand">
					<span className="donna-mark" aria-hidden="true">
						d
					</span>
					<span>Donna</span>
					<Button
						variant="ghost"
						size="icon-sm"
						className="sidebar-close"
						aria-label="Close conversations"
						onClick={onClose}
					>
						<Menu />
					</Button>
				</div>
				<nav aria-label="Conversation history" className="thread-list">
					{mainThread && (
						<Button
							variant="ghost"
							className={`main-chat-link ${selected === mainThread.id && activeTab === 'chat' ? 'selected' : ''}`}
							aria-current={selected === mainThread.id && activeTab === 'chat' ? 'page' : undefined}
							disabled={busy}
							onClick={() => onSelect(mainThread.id)}
						>
							<House size={18} /> Main chat
						</Button>
					)}
					<div className="side-chat-heading">
						<h2>Side chats</h2>
					</div>
					<div className="search-wrap">
						<Search size={16} aria-hidden="true" />
						<Input
							type="search"
							aria-label="Search side chats"
							placeholder="Search side chats"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
					</div>
					{visible.map((thread) => (
						<div
							className={`thread-row ${selected === thread.id && activeTab === 'chat' ? 'selected' : ''}`}
							key={thread.id}
						>
							{editing === thread.id ? (
								<form
									className="thread-rename"
									onSubmit={(event) => {
										event.preventDefault()
										if (!titleDraft.trim()) return
										void onRename(thread.id, titleDraft.trim())
										setEditing(null)
									}}
								>
									<Input
										aria-label="Conversation title"
										autoFocus
										maxLength={100}
										value={titleDraft}
										onChange={(event) => setTitleDraft(event.target.value)}
										onKeyDown={(event) => {
											if (event.key === 'Escape') setEditing(null)
										}}
									/>
									<Button
										type="submit"
										size="sm"
										aria-label="Save title"
										disabled={!titleDraft.trim()}
									>
										Save
									</Button>
								</form>
							) : (
								<>
									<Button
										variant="ghost"
										className="thread-select"
										aria-current={
											selected === thread.id && activeTab === 'chat' ? 'page' : undefined
										}
										disabled={busy}
										onClick={() => onSelect(thread.id)}
									>
										<MessageCircle size={16} />
										<span>{thread.title}</span>
									</Button>
									<div className="thread-actions">
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={`Rename ${thread.title}`}
											title="Rename"
											disabled={busy}
											onClick={() => {
												setEditing(thread.id)
												setTitleDraft(thread.title)
											}}
										>
											<Pencil size={14} />
										</Button>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={`Delete ${thread.title}`}
											title="Delete"
											disabled={busy}
											onClick={() => setDeleting(thread)}
										>
											<Trash2 size={14} />
										</Button>
									</div>
								</>
							)}
						</div>
					))}
					{visible.length === 0 && (
						<p className="sidebar-empty">
							{search ? 'No matching side chats' : 'No side chats yet'}
						</p>
					)}
				</nav>
				<Button
					variant="outline"
					className="new-chat"
					disabled={busy || !mainThread}
					onClick={onCreate}
				>
					<Plus size={17} /> New side chat
				</Button>
				<Button
					variant="ghost"
					className={`settings-link ${activeTab === 'settings' ? 'selected' : ''}`}
					aria-current={activeTab === 'settings' ? 'page' : undefined}
					onClick={onSettings}
				>
					<Settings size={17} /> Settings
				</Button>
			</aside>
			<AlertDialog
				open={Boolean(deleting)}
				onOpenChange={(isOpen) => {
					if (!isOpen) setDeleting(null)
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete chat?</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently deletes “{deleting?.title}” and its messages.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								if (deleting) void onDelete(deleting.id)
								setDeleting(null)
							}}
						>
							Delete chat
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
