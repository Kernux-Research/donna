import { DonnaThreadSchema } from '@donna/api-contract'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { DonnaSidebar } from './DonnaSidebar'

const main = DonnaThreadSchema.parse({
	id: 'c41a978e-51a3-44da-a3c2-fd2b0cdb7ef9',
	title: 'Main',
	kind: 'main',
	createdAt: '2026-01-01T00:00:00Z',
	updatedAt: '2026-01-01T00:00:00Z',
})
const first = DonnaThreadSchema.parse({
	id: '42c0ca61-c20c-487b-95df-2bfb93c4b797',
	title: 'Travel plans',
	createdAt: '2026-01-01T00:00:00Z',
	updatedAt: '2026-01-01T00:00:00Z',
})
const second = DonnaThreadSchema.parse({
	id: 'aa32cfc0-6d03-41ed-8b5f-5640b42f6633',
	title: 'Recipe ideas',
	createdAt: '2026-01-02T00:00:00Z',
	updatedAt: '2026-01-02T00:00:00Z',
})

it('searches conversations, renames inline, and confirms deletion', () => {
	const onRename = vi.fn().mockResolvedValue(undefined)
	const onDelete = vi.fn().mockResolvedValue(undefined)
	render(
		<DonnaSidebar
			mainThread={main}
			activeTab="chat"
			threads={[main, first, second]}
			selected={first.id}
			busy={false}
			open={false}
			onCreate={() => {}}
			onClose={() => {}}
			onSettings={() => {}}
			onSelect={() => {}}
			onRename={onRename}
			onDelete={onDelete}
		/>
	)
	fireEvent.change(screen.getByRole('searchbox', { name: 'Search side chats' }), {
		target: { value: 'travel' },
	})
	expect(screen.getByRole('button', { name: 'Travel plans' })).toBeTruthy()
	expect(screen.queryByRole('button', { name: 'Recipe ideas' })).toBeNull()
	expect(screen.getByRole('button', { name: 'Main chat' })).toBeTruthy()
	expect(screen.queryByRole('button', { name: 'Delete Main' })).toBeNull()
	fireEvent.click(screen.getByRole('button', { name: 'Rename Travel plans' }))
	fireEvent.change(screen.getByRole('textbox', { name: 'Conversation title' }), {
		target: { value: 'Summer trip' },
	})
	fireEvent.click(screen.getByRole('button', { name: 'Save title' }))
	expect(onRename).toHaveBeenCalledWith(first.id, 'Summer trip')
	fireEvent.click(screen.getByRole('button', { name: 'Delete Travel plans' }))
	const dialog = screen.getByRole('alertdialog', { name: 'Delete chat?' })
	expect(onDelete).not.toHaveBeenCalled()
	fireEvent.click(within(dialog).getByRole('button', { name: 'Delete chat' }))
	expect(onDelete).toHaveBeenCalledWith(first.id)
})
