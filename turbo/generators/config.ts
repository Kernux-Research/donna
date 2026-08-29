import { NewPackageAnswers, NewWorkerAnswers, NewWorkflowsAnswers } from './answers'
import { packageDestination } from './helpers/package-destination'
import {
	pascalText,
	pascalTextPlural,
	pascalTextSingular,
	slugifyText,
	slugifyTextPlural,
	slugifyTextSingular,
} from './helpers/slugify'
import { nameValidator } from './helpers/validate'
import { fixAll } from './plugins/fix-all'
import { fixDepsAndFormat } from './plugins/fix-deps-and-format'
import { pnpmInstall } from './plugins/pnpm-install'

import type { PlopTypes } from '@turbo/gen'

export default function generator(plop: PlopTypes.NodePlopAPI): void {
	// SAFETY: Turbo's Plop action type omits the answer shape supplied by these validated actions.
	plop.setActionType('pnpmInstall', pnpmInstall as PlopTypes.CustomActionFunction)
	// SAFETY: Turbo's Plop action type omits the answer shape supplied by these validated actions.
	plop.setActionType('fixAll', fixAll as PlopTypes.CustomActionFunction)
	// SAFETY: Turbo's Plop action type omits the answer shape supplied by these validated actions.
	plop.setActionType('fixDepsAndFormat', fixDepsAndFormat as PlopTypes.CustomActionFunction)

	plop.setHelper('slug', slugifyText)
	plop.setHelper('slug-s', slugifyTextSingular)
	plop.setHelper('slug-p', slugifyTextPlural)

	plop.setHelper('pascal', pascalText)
	plop.setHelper('pascal-s', pascalTextSingular)
	plop.setHelper('pascal-p', pascalTextPlural)

	plop.setGenerator('new-worker', {
		description: 'Create a new Cloudflare Worker using Hono',
		prompts: [
			{
				type: 'input',
				name: 'name',
				message: 'name of worker',
				validate: nameValidator,
			},
		],
		actions: (data) => {
			const answers = NewWorkerAnswers.parse(data)
			process.chdir(answers.turbo.paths.root)
			const destination = packageDestination(answers.turbo.paths, slugifyText(answers.name), 'apps')

			const actions: PlopTypes.Actions = [
				{
					type: 'addMany',
					base: 'templates/fetch-worker',
					destination,
					templateFiles: [
						'templates/fetch-worker/**/**.hbs',
						// dotfiles must be listed explicitly - '**.hbs' doesn't match them
						'templates/fetch-worker/.env.example.hbs',
					],
					data: answers,
				},
				{ type: 'pnpmInstall' },
				{ type: 'fixAll' },
				{ type: 'pnpmInstall' },
			]

			return actions
		},
	})

	plop.setGenerator('new-worker-vite', {
		description: 'Create a new Cloudflare Worker using Hono and Vite',
		prompts: [
			{
				type: 'input',
				name: 'name',
				message: 'name of worker',
				validate: nameValidator,
			},
		],
		actions: (data) => {
			const answers = NewWorkerAnswers.parse(data)
			process.chdir(answers.turbo.paths.root)
			const destination = packageDestination(answers.turbo.paths, slugifyText(answers.name), 'apps')

			const actions: PlopTypes.Actions = [
				{
					type: 'addMany',
					base: 'templates/fetch-worker-vite',
					destination,
					templateFiles: [
						'templates/fetch-worker-vite/**/**.hbs',
						// dotfiles must be listed explicitly - '**.hbs' doesn't match them
						'templates/fetch-worker-vite/.env.example.hbs',
					],
					data: answers,
				},
				{ type: 'pnpmInstall' },
				{ type: 'fixAll' },
				{ type: 'pnpmInstall' },
			]

			return actions
		},
	})

	plop.setGenerator('new-worker-minimal', {
		description: 'Create a new Cloudflare Worker with a minimal fetch handler',
		prompts: [
			{
				type: 'input',
				name: 'name',
				message: 'name of worker',
				validate: nameValidator,
			},
		],
		actions: (data) => {
			const answers = NewWorkerAnswers.parse(data)
			process.chdir(answers.turbo.paths.root)
			const destination = packageDestination(answers.turbo.paths, slugifyText(answers.name), 'apps')

			const actions: PlopTypes.Actions = [
				{
					type: 'addMany',
					base: 'templates/fetch-worker-minimal',
					destination,
					templateFiles: [
						'templates/fetch-worker-minimal/**/**.hbs',
						// dotfiles must be listed explicitly - '**.hbs' doesn't match them
						'templates/fetch-worker-minimal/.env.example.hbs',
					],
					data: answers,
				},
				{ type: 'pnpmInstall' },
				{ type: 'fixAll' },
				{ type: 'pnpmInstall' },
			]

			return actions
		},
	})

	plop.setGenerator('workflows-worker', {
		description: 'Create a new Cloudflare Worker using Hono and Cloudflare Workflows',
		prompts: [
			{
				type: 'input',
				name: 'name',
				message: 'name of worker',
				validate: nameValidator,
			},
			{
				type: 'input',
				name: 'workflowName',
				message: 'name of Workflow',
				validate: nameValidator,
			},
		],
		actions: (data) => {
			const answers = NewWorkflowsAnswers.parse(data)
			process.chdir(answers.turbo.paths.root)
			const destination = packageDestination(answers.turbo.paths, slugifyText(answers.name), 'apps')

			const actions: PlopTypes.Actions = [
				{
					type: 'addMany',
					base: 'templates/workflows-worker',
					destination,
					templateFiles: [
						'templates/workflows-worker/**/**.hbs',
						// dotfiles must be listed explicitly - '**.hbs' doesn't match them
						'templates/workflows-worker/.env.example.hbs',
					],
					data: answers,
				},
				{ type: 'pnpmInstall' },
				{ type: 'fixAll' },
				{ type: 'pnpmInstall' },
			]

			return actions
		},
	})

	plop.setGenerator('new-package', {
		description: 'Create a new shared package',
		prompts: [
			{
				type: 'input',
				name: 'name',
				message: 'name of package',
				validate: nameValidator,
			},
			{
				type: 'confirm',
				name: 'usedInWorkers',
				message: 'Will this package be used within Cloudflare Workers?',
				default: true,
			},
		],
		actions: (data) => {
			const answers = NewPackageAnswers.parse(data)
			process.chdir(answers.turbo.paths.root)
			const destination = packageDestination(answers.turbo.paths, slugifyText(answers.name))

			const actions: PlopTypes.Actions = [
				{
					type: 'addMany',
					base: 'templates/package',
					destination,
					templateFiles: ['templates/package/**/**.hbs'],
					data: {
						...answers,
						tsconfigType: answers.usedInWorkers ? 'workers-lib.json' : 'lib.json',
					},
				},
				{ type: 'fixDepsAndFormat' },
				{ type: 'pnpmInstall' },
			]

			return actions
		},
	})
}
