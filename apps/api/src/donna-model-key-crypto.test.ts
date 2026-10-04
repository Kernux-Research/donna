import { expect, it } from 'vitest'

import { decryptDonnaModelKey, encryptDonnaModelKey } from './donna-model-key-crypto'

it('encrypts provider credentials with a unique IV and refuses another encryption key', async () => {
	const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
	const other = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
	const first = await encryptDonnaModelKey('provider-secret', key)
	const second = await encryptDonnaModelKey('provider-secret', key)
	expect(first).not.toEqual(second)
	expect(JSON.stringify(first)).not.toContain('provider-secret')
	expect(await decryptDonnaModelKey(first, key)).toBe('provider-secret')
	await expect(decryptDonnaModelKey(first, other)).rejects.toThrow()
})
