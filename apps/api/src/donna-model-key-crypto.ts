export interface EncryptedDonnaModelKey {
	iv: string
	ciphertext: string
}

function importEncryptionKey(encoded: string): Promise<CryptoKey> {
	const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
	if (bytes.length !== 32) throw new Error('model_key_encryption_invalid')
	return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** Encrypt a user's model API key before writing it to Durable Object storage. */
export async function encryptDonnaModelKey(
	apiKey: string,
	encodedKey: string
): Promise<EncryptedDonnaModelKey> {
	const iv = crypto.getRandomValues(new Uint8Array(12))
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		await importEncryptionKey(encodedKey),
		new TextEncoder().encode(apiKey)
	)
	return {
		iv: btoa(String.fromCharCode(...iv)),
		ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
	}
}

/** Decrypt a stored model API key only inside the API Worker's inference path. */
export async function decryptDonnaModelKey(
	value: EncryptedDonnaModelKey,
	encodedKey: string
): Promise<string> {
	const iv = Uint8Array.from(atob(value.iv), (character) => character.charCodeAt(0))
	const ciphertext = Uint8Array.from(atob(value.ciphertext), (character) => character.charCodeAt(0))
	const plain = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv },
		await importEncryptionKey(encodedKey),
		ciphertext
	)
	return new TextDecoder().decode(plain)
}
