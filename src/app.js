'use strict'

const fs = require('fs')
const chalk = require('chalk')
const inquirer = require('inquirer')
const filesize = require('filesize')
const complexFilter = require('complex-filter')
const PassThrough = require('stream').PassThrough
const t2 = require('through2')


const Spinner = require('cli-spinner').Spinner
const spinnerLoadingTomo = new Spinner(chalk.cyan('Loading tomograms, please wait - ') + chalk.hex('#FF6E1E')('%s'))
spinnerLoadingTomo.setSpinnerString(18)


const OIPJS = require('oip-js').OIPJS
const Core = OIPJS({
	OIPdURL: 'https://snowflake.oip.fun/alexandria/v2',
	indexFilters: {
		publisher: 'FTSTq8xx8yWUKJA5E3bgXLzZqqG9V6dvnr'
	},
	runIPFSJS: true
})

const simpleType2Subtypes = {
	Tiltseries: 'TiltSeries',
	Reconstruction: 'Reconstructions',
	Subvolume: 'Subvolumes',
	Keymov: 'Movies',
	Keyimg: 'Images',
	Snapshot: 'Images',
	Other: 'Others'
}

module.exports = (queryStack, fileType) => {
	spinnerLoadingTomo.start()
	Core.Index.getSupportedArtifacts((artifacts) => {
		spinnerLoadingTomo.stop()
		const filter = complexFilter(queryStack)
		const selected = artifacts.filter(filter)

		const downloadList = []
		const numberOfStreamed = artifacts.length
		const numberOfSelectedArtifacts = selected.length
		let totalDownloadSize = 0
		let numberOfSelectedFiles = 0

		selected.forEach((artifact) => {
			let files = artifact.getFiles()

			if (!(fileType === 'All')) {
				files = files.filter((file) => {
					return fileType.indexOf(simpleType2Subtypes[file.getSubtype()]) !== -1
				})
			}
			numberOfSelectedFiles += files.length
			files.forEach((file) => {
				totalDownloadSize += file.getFilesize()
			})
		})

		const fileSize = filesize(totalDownloadSize, {base: 10})

		inquirer.prompt([{
			message: chalk.cyan(`\nThe search parameters let to a ${numberOfSelectedArtifacts} records with ${numberOfSelectedFiles} files with a total of ${fileSize} for download. Would you like to proceed?`),
			type: 'confirm',
			name: 'answer'
		}])
			.then((answer) => {
				if (answer.answer) {
					const directoryName = `etdb-download-${Date.now()}`
					process.stdout.write(`Making new directory: ${directoryName}\n`)
					fs.mkdirSync(directoryName)
					process.stdout.write(`Entering new directory: ${directoryName}\n`)
					process.chdir(directoryName)
					selected.forEach((artifact) => {
						const artifactID = artifact.txid.slice(0, 6)
						process.stdout.write(`-Dealing with files/metadata from tomogram: ${chalk.green(artifactID)}\n`)
						process.stdout.write(`--Making new directory: ${chalk.green(artifactID)}\n`)
						fs.mkdirSync(artifactID)
						process.stdout.write(`--Entering new directory: ${chalk.green(artifactID)}\n`)
						process.chdir(artifactID)
						let files = artifact.getFiles()
						if (fileType !== 'All') {
							files = files.filter((file) => {
								return fileType.indexOf(simpleType2Subtypes[file.getSubtype()]) !== -1
							})
						}
						const streams = []

						files.forEach((file) => {
							process.stdout.write(`---Downloading file ${chalk.cyan(file.getDisplayName())} at ${chalk.cyan(artifact.getLocation())}\n`)
							const ipfsFilePath = '/ipfs/' + artifact.getLocation() + '/' + file.getFilename()
							console.log(ipfsFilePath)
							const readStream = Core.Network.ipfs.files.getReadableStream(artifact.getLocation())
							// const writeStream = fs.createWriteStream(file.getDisplayName())

							const p = new Promise((resolve, reject) => {
								readStream.on('data', (data) => {
									console.log(data)
									resolve(data)
								})
									.on('error', (err) => {
										console.log(err)
									})
							})
							streams.push(p)
						})
						Promise.all(streams).then((strms) => {
							console.log('dsadsa')
							console.log(strms.path)
						})
						process.stdout.write(`--Exting directory:${chalk.green(artifactID)}\n`)
						process.chdir('..')
					})
					process.stdout.write(`Exiting directory: ${directoryName}\n`)
					process.chdir('..')
				}

				process.stdout.write('Done processing\n')
			})
			.catch((err) => {
				console.error(err)
			})
	}, (error) => {
		console.error(error)
		process.exit()
	})
}

