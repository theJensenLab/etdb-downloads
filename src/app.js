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
const ipfsA = new ipfsAPI()

const Spinner = require('cli-spinner').Spinner
const spinnerLoadingTomo = new Spinner(chalk.cyan('Loading tomograms, please wait - ') + chalk.hex('#FF6E1E')('%s'))
spinnerLoadingTomo.setSpinnerString(18)


const OIPJS = require('oip-js').OIPJS
const Core = OIPJS({
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

const filterExistingFiles = (files, location, localDirectory) => {
	return new Promise((resolve, reject) => {
		const promises = []
		files.forEach((file) => {
			const fileIpfsPath = '/ipfs/' + location + '/' + file.getFilename()
			const filePath = path.resolve(localDirectory, location, file.getDisplayName())
			const promise = new Promise((res, rej) => {
				if (fs.existsSync(filePath)) {
					return ipfsA.files.add([{content: fs.createReadStream(filePath)}], {hashOnly: true, rawLeaves: true})
						.then((results) => {
							ipfsA.files.stat(fileIpfsPath).then((info) => {
								const localFileHash = results[0].hash
								if (info.hash === localFileHash) {
									// process.stdout.write(chalk.green(info.hash) + ' - ' + chalk.red(localFileHash) + '\n')
									process.stdout.write(chalk.red(`File ${file.getDisplayName()} exists. Skiping\n`))
									res(false)
									return
								}
								// process.stdout.write(chalk.green(info.hash) + ' - ' + chalk.red(localFileHash) + '\n')
								process.stdout.write(chalk.yellow(`File ${file.getDisplayName()} exists but is corrupt. Scheduling for download\n`))
								res(true)
								return
							})
						})
						.catch((err) => {
							reject(err)
						})
				}
				// process.stdout.write(chalk.green(`File ${file.getDisplayName()} does not exist. Scheduling for download\n`))
				res(true)
				return true
			})
			promises.push(promise)
		})

		Promise.all(promises)
			.then((schedule) => {
				files = files.filter((file, i) => {
					return schedule[i]
				})
				resolve(files, schedule)
			})
			.catch((err) => {
				throw err
			})
	})
}

const getStats = function(artifacts, fileType, directoryName) {
	process.stdout.write(`${chalk.cyan('Checking for already downloaded files...')}\n`)
	return new Promise((resolve, reject) => {
		let stats = {
			totalDownloadSize: 0,
			numberOfSelectedFiles: 0
		}
		const promises = []
		artifacts.forEach((artifact) => {
			let files = artifact.getFiles()
			if (!(fileType === 'All')) {
				files = files.filter((file) => {
					return fileType.indexOf(simpleType2Subtypes[file.getSubtype()]) !== -1
				})
			}
			promises.push(
				filterExistingFiles(files, artifact.getLocation(), directoryName).then((selectedFiles, schedule) => {
					stats.numberOfSelectedFiles += selectedFiles.length
					selectedFiles.forEach((file) => {
						stats.totalDownloadSize += file.getFilesize()
					})
					return selectedFiles
				})
					.catch((err) => {
						throw err
					})
			)
		})
		Promise.all(promises)
			.then((results) => {
				resolve(stats)
			})
			.catch((err) => {
				process.stdout.write(`${chalk.red('Something is wrong processing artifact...')}\n`)
				reject(err)
			})
	})
}

module.exports = (queryStack, fileType, resume) => {
	spinnerLoadingTomo.start()
	Core.Index.getArtifacts('*', (artifacts) => {
		spinnerLoadingTomo.stop()
		process.stdout.write('\n')
		const filter = complexFilter(queryStack)
		const selected = artifacts.filter(filter)
		let directoryName = resume || `etdb-download-${Date.now()}`

		getStats(selected, fileType, directoryName)
			.then((stats) => {
				process.stdout.write(`${chalk.cyan('Done processing artifacts...')}\n`)
				const numberOfSelectedArtifacts = selected.length
				inquirer.prompt([{
					message: chalk.cyan(`\nThe search parameters let to a ${numberOfSelectedArtifacts} records with ${stats.numberOfSelectedFiles} files with a total of ${filesize(stats.totalDownloadSize, {base: 10})} for download. Would you like to proceed?`),
					type: 'confirm',
					name: 'answer'
				}])
					.then((answer) => {
						if (answer.answer) {
							let action = ''
							if (!fs.existsSync(directoryName)) {
								fs.mkdirSync(directoryName)
								action = `Making new directory: ${chalk.green(directoryName)}\n`
							}
							else {
								action = `Entering existing directory: ${chalk.green(resume)}\n`
								directoryName = resume
							}
							process.stdout.write(action)
							const jobPath = path.resolve(directoryName)
							let currentStats = {
								dataDownloaded: 0,
								filesDownloaded: 0
							}
							selected.forEach((artifact) => {
								const artifactLocation = artifact.getLocation()
								// process.stdout.write(`-Dealing with files/metadata from tomogram: ${chalk.green(artifactLocation)}\n`)
								const artifactPath = path.resolve(jobPath, artifactLocation)
								if (!fs.existsSync(artifactPath))
									fs.mkdirSync(artifactPath)
								let files = artifact.getFiles()
								if (fileType !== 'All') {
									files = files.filter((file) => {
										return fileType.indexOf(simpleType2Subtypes[file.getSubtype()]) !== -1
									})
								}
								filterExistingFiles(files, artifact.getLocation(), directoryName)
									.then((selectedFiles, schedule) => {
										if (selectedFiles.length !== 0)
											process.stdout.write(`-Dealing with files/metadata from tomogram: ${chalk.green(artifactLocation)}\n`)
										selectedFiles.forEach((file) => {
											const ipfsFilePath = artifact.getLocation() + '/' + file.getFilename()
											const filePath = path.resolve(artifactPath, file.getDisplayName())
											const readStream = ipfsA.files.getReadableStream(ipfsFilePath)
											readStream.pipe(through2.obj((data, enc, next) => {
												process.stdout.write(`-- ${chalk.green(artifactLocation)} - Initiating download of ${chalk.cyan(file.getDisplayName())} at ${chalk.cyan(artifact.getLocation())}\n`)
												const writeStream = fs.createWriteStream(filePath)
												data.content
													.pipe(writeStream)
													.on('finish', () => {
														// spinnerDownloadingFiles.stop()
														process.stdout.write('\n')
														const progressSize = Math.ceil(currentStats.dataDownloaded / stats.totalDownloadSize * 100)
														const progressCount = Math.ceil(currentStats.filesDownloaded / stats.numberOfSelectedFiles * 100)
														currentStats.dataDownloaded += file.getFilesize()
														currentStats.filesDownloaded++
														const dataDownloadedReadable = filesize(currentStats.dataDownloaded, {base: 10})
														process.stdout.write(`-- ${chalk.green(artifactLocation)} - ${chalk.cyan(file.getDisplayName())} download complete.\n`)
														process.stdout.write(`Progress: Files downloaded: ${chalk.hsl(progressCount, 50, 50)(currentStats.filesDownloaded)}/${chalk.green(stats.numberOfSelectedFiles)}, ${chalk.hsl(progressSize, 50, 50)(dataDownloadedReadable)}/${chalk.green(filesize(stats.totalDownloadSize, {base: 10}))}.\n`)
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
										})
									})
									.catch((err) => {
										console.log(err)
										throw err
									})
							})
						}
					})
					.catch((err) => {
						spinnerLoadingTomo.stop()
						console.log('Error in input the choice')
						console.error(err)
					})
			})
			.catch((err) => {
				console.log('Error in getting the metadata of tomograms')
				console.log(err)
				throw err
			})
	}, (error) => {
		spinnerLoadingTomo.stop()
		console.log('Error in getting the metadata of tomograms')
		console.error(error)
	})
}
