'use strict'

const stream = require('stream')
const through2 = require('through2')
const chalk = require('chalk')
const inquirer = require('inquirer')
const filesize = require('filesize')

const simpleType2Subtypes = {
	'Tiltseries': 'TiltSeries',
	'Reconstruction': 'Reconstruction',
	'Subvolume': 'Subvolume',
	'Keymov': 'Movie',
	'Keyimg': 'Image',
	'Snapshot': 'Image',
	'Other': 'Other'
}

const Spinner = require('cli-spinner').Spinner
const spinnerLoadingTomo = new Spinner(chalk.cyan('Loading tomograms, please wait - ') + chalk.hex('#FF6E1E')('%s'))
spinnerLoadingTomo.setSpinnerString(18)

const spinnerProcessing = new Spinner(chalk.cyan('Processing stream - ') + chalk.hex('#FF6E1E')('%s'))
spinnerProcessing.setSpinnerString(18)

const complexFilterStream = require('complex-filter-stream')

const OIPJS = require('oip-js').OIPJS

const Core = OIPJS({
	OIPdURL: 'https://snowflake.oip.fun/alexandria/v2',
	indexFilters: {
		publisher: 'FTSTq8xx8yWUKJA5E3bgXLzZqqG9V6dvnr'
	}
})

module.exports = (queryStack, fileType) => {
	process.stdout.write(fileType)
	spinnerLoadingTomo.start()
	Core.Index.getSupportedArtifacts((artifacts) => {
		spinnerLoadingTomo.stop()
		const artifactStream = new stream.Readable({objectMode: true})
		artifacts.map((artifact, i) => {
			artifactStream.push(artifact)
		})
		artifactStream.push(null)
		
		const filter = complexFilterStream(queryStack)
		const downloadList = []
		let totalDownload = 0
		process.stdout.write(chalk.cyan('\nFiltering streams'))
		let numberOfStreamed = 0
		let numberOfSelected = 0
		spinnerProcessing.start()
		artifactStream
			.on('data', () => {
				numberOfStreamed++
				process.stdout.clearLine()
				process.stdout.cursorTo(0)
			})
			.pipe(filter)
			.on('data', (chunk) => {
				numberOfSelected++
				// process.stdout.write(chunk.artifact.details.sid)
				const files = chunk.getFiles()
				files.filter((file) => {
					return simpleType2Subtypes[file.getSubtype()] === fileType
				})
				files.map((file) => {
					totalDownload += file.getFilesize()
				})
			})
			.on('finish', () => {
				spinnerProcessing.stop()
				console.log('hey')
				const fileSize = filesize(totalDownload, {base: 10})
				inquirer.prompt([{
					message: chalk.cyan(`The search parameters let to a ${numberOfSelected} files with a total of ${fileSize} for download. Would you like to proceed?`),
					type: 'confirm',
					name: 'answer'
				}], (answer) => {
					process.stdout.write(answer)
				})
			})
	}, (error) => {
		console.error(error)
		process.exit()
	})
}

