import { chalk, echo, fs } from 'zx'

/** Copy the example environment file for local development when needed. */
export async function ensureEnvironmentFileExists(): Promise<void> {
	const [environmentFileExists, exampleEnvironmentFileExists] = await Promise.all([
		fs.pathExists('.env'),
		fs.pathExists('.env.example'),
	])

	if (!environmentFileExists && exampleEnvironmentFileExists) {
		echo(chalk.grey('Copying .env.example to .env'))
		await fs.copy('.env.example', '.env')
	}
}
