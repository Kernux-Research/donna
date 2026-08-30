import type { ProcessOutput } from 'zx'

export function onProcSuccess(
	name: string,
	resolve: (value: string | PromiseLike<string>) => void,
	reject: (reason?: string) => void
) {
	return (proc: ProcessOutput) => {
		if (proc.exitCode === 0) {
			resolve(`${name} ran correctly`)
		} else {
			reject(`${name} exited with ${proc.exitCode}`)
		}
	}
}

export function catchError(reject: (reason?: string) => void) {
	return () => reject('unknown error')
}
