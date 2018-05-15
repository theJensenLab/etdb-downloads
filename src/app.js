'use strict'

const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const inquirer = require('inquirer')
const filesize = require('filesize')
const complexFilter = require('complex-filter')
const through2 = require('through2')

const ipfsAPI = require('ipfs-api')
const ipfs = new ipfsAPI({host: 'gateway.ipfs.io', port: 443, protocol: 'https'})

const Spinner = require('cli-spinner').Spinner
const spinnerLoadingTomo = new Spinner(chalk.cyan('Loading tomograms, please wait - ') + chalk.hex('#FF6E1E')('%s'))
spinnerLoadingTomo.setSpinnerString(18)


const OIPJS = require('oip-js').OIPJS
const Core = OIPJS({
	OIPdURL: 'https://snowflake.oip.fun/alexandria/v2',
	indexFilters: {
		publisher: 'FTSTq8xx8yWUKJA5E3bgXLzZqqG9V6dvnr'
	}
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

module.exports = (queryStack, fileType, resume) => {
	spinnerLoadingTomo.start()
	Core.Index.getArtifacts('*', (artifacts) => {
		spinnerLoadingTomo.stop()
		const filter = complexFilter(queryStack)
		const selected = artifacts.filter(filter)

		const downloadList = []
		const numberOfSelectedArtifacts = selected.length
		let totalDownloadSize = 0
		let numberOfSelectedFiles = 0

		selected.forEach((artifact) => {
			const artifactPath = path.resolve(resume, artifact.txid.slice(0, 6))
			let files = artifact.getFiles()
			if (!(fileType === 'All')) {
				files = files.filter((file) => {
					let filterIn = fileType.indexOf(simpleType2Subtypes[file.getSubtype()]) !== -1
					if (resume)
						filterIn = filterIn && fs.exists(path.resolve(artifactPath, file.getFilename))
					return filterIn
				})
			}
			numberOfSelectedFiles += files.length
			files.forEach((file) => {
				totalDownloadSize += file.getFilesize()
			})
		})

		const totalDownloadSizeReadable = filesize(totalDownloadSize, {base: 10})

		inquirer.prompt([{
			message: chalk.cyan(`\nThe search parameters let to a ${numberOfSelectedArtifacts} records with ${numberOfSelectedFiles} files with a total of ${totalDownloadSizeReadable} for download. Would you like to proceed?`),
			type: 'confirm',
			name: 'answer'
		}])
			.then((answer) => {
				if (answer.answer) {
					let directoryName = `etdb-download-${Date.now()}`
					let action = `Making new directory: ${chalk.green(directoryName)}\n`
					if (!resume) {
						fs.mkdirSync(directoryName)
					}
					else {
						action = `Entering existing directory: ${chalk.greed(resume)}\n`
						directoryName = resume
					}
					process.stdout.write(action)
					const jobPath = path.resolve(directoryName)
					let dataDownloaded = 0
					let filesDownloaded = 0
					selected.forEach((artifact) => {
						const artifactID = artifact.txid.slice(0, 6)
						process.stdout.write(`-Dealing with files/metadata from tomogram: ${chalk.green(artifactID)}\n`)
						const tomoPath = path.resolve(jobPath, artifactID)
						if (!fs.existsSync(tomoPath))
							fs.mkdirSync(tomoPath)
						let files = artifact.getFiles()
						if (fileType !== 'All') {
							files = files.filter((file) => {
								return fileType.indexOf(simpleType2Subtypes[file.getSubtype()]) !== -1
							})
						}
						files.forEach((file) => {
							const ipfsFilePath = artifact.getLocation() + '/' + file.getFilename()
							const filePath = path.resolve(tomoPath, file.getDisplayName())
							if (fs.existsSync(filePath)) {
								if (fs.statSync(filePath).size !== file.getFilesize()) {
									fs.unlink(filePath)
									const readStream = ipfs.files.getReadableStream(ipfsFilePath)	
									readStream.pipe(through2.obj((data, enc, next) => {
										process.stdout.write(`-- ${chalk.green(artifactID)} - Initiating download of ${chalk.cyan(file.getDisplayName())} at ${chalk.cyan(artifact.getLocation())}\n`)
										const writeStream = fs.createWriteStream(filePath)
										data.content
											.pipe(writeStream)
											.on('finish', () => {
												const progressSize = dataDownloaded / totalDownloadSize * 100
												const progressCount = filesDownloaded / numberOfSelectedFiles * 100
												dataDownloaded += file.getFilesize()
												filesDownloaded++
												const dataDownloadedReadable = filesize(dataDownloaded, {base: 10})
												process.stdout.write(`-- ${chalk.green(artifactID)} - ${chalk.cyan(file.getDisplayName())} download complete.\n`)
												process.stdout.write(`Progress: Files downloaded: ${chalk.hsl(progressCount, 50, 50)(filesDownloaded)}/${chalk.green(numberOfSelectedFiles)}, ${chalk.hsl(progressSize, 50, 50)(dataDownloadedReadable)}/${chalk.green(totalDownloadSizeReadable)}.\n`)
											})
											.on('error', (err) => {
												console.log('Error in processing the data')
												throw err
											})
									}))
										.on('error', (err) => {
											console.log('Error in retrieving the data')
											console.log(err)
										})
								}

							}
							
						})
					})
				}
			})
			.catch((err) => {
				console.log('Error in input the choice')
				console.error(err)
			})
	}, (error) => {
		console.log('Error in getting the metadata of tomograms')
		console.error(error)
	})
}
