'use strict'

const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const inquirer = require('inquirer')
const filesize = require('filesize')
const complexFilter = require('complex-filter')
const through2 = require('through2')
const Listr = require('listr')
const Observable = require('zen-observable')

process.env.IPFS_BOOTSTRAP = 1

const ipfsAPI = require('ipfs-api')
const ipfsB = new ipfsAPI({
	host: '127.0.0.1',
	port: 5002,
	protocol: 'http'
})
const ipfs = new ipfsAPI(
	{
		host: 'gateway.ipfs.io',
		port: 443,
		protocol: 'https'
	})
const IPFS = require('ipfs')
const ipfsA = new IPFS({
	repo: './.ipfsRepo'
})

ipfsA.on('error', (error) => {
	console.log('Error with js-IPFS')
	console.error(error.message)
})

const Spinner = require('ora')
const spinnerLoadingTomo = new Spinner(chalk.cyan('Loading tomograms, please wait'))


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
			// process.stdout.write(chalk.green(`File ${file.getDisplayName()}`))
			const promise = new Promise((res, rej) => {
				if (fs.existsSync(filePath)) {
					return ipfsA.files.add([{content: fs.createReadStream(filePath)}], {hashOnly: true, rawLeaves: true})
						.then((results) => {
							console.log('here')
							console.log(results)
							ipfsB.files.stat(fileIpfsPath)
								.then((info) => {
									console.log('even here')
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
								.catch((err) => {
									console.log('Error!!!')
									console.log(err)
									reject(err)
								})
						})
						.catch((err) => {
							console.log(err)
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

module.exports = (queryStack, fileType, resume, threads) => {
	ipfsA.on('ready', () => {
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
					stats.numberOfSelectedArtifacts = selected.length
					return stats
				})
				.then((stats) => {
					return inquirer.prompt([{
						message: chalk.cyan(`\nThe search parameters let to a ${stats.numberOfSelectedArtifacts} records with ${stats.numberOfSelectedFiles} files with a total of ${filesize(stats.totalDownloadSize, {base: 10})} for download. Would you like to proceed?`),
						type: 'confirm',
						name: 'answer'
					}]).then((answer) => {
						stats.answer = answer
						return stats
					})
				})
				.then((stats) => {
					const promises = []
					const downloads = []
					if (stats.answer.answer) {
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
						process.stdout.write(chalk.cyan('Writing metadata...\n'))
						const selectedJSON = JSON.stringify(selected, null, ' ')
						fs.writeFileSync(path.resolve(jobPath, 'metadata.json'), selectedJSON)
						process.stdout.write(chalk.cyan('Initiating download...\n'))
						selected.forEach((artifact) => {
							const p = new Promise((res, rej) => {
								const artifactLocation = artifact.getLocation()
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
											process.stdout.write(`- Dealing with files from tomogram: ${chalk.green(artifactLocation)}\n`)
										selectedFiles.forEach((file) => {
											const ipfsFilePath = artifact.getLocation() + '/' + file.getFilename()
											const filePath = path.resolve(artifactPath, file.getDisplayName())
											const readStream = ipfs.files.getReadableStream(ipfsFilePath)
											downloads.push(
												{
													title: ` ${chalk.green(artifactLocation)} - Initiating download of ${chalk.cyan(file.getDisplayName())} at ${chalk.cyan(artifact.getLocation())}`,
													task: () => {
														return new Observable((observer) => {
															let downloaded = 0
															const totalDownload = file.getFilesize()
															observer.next(`Progress: ${filesize(downloaded, {base: 10})}/${filesize(totalDownload, {base: 10})}`)
															readStream
																.on('error', (err) => {
																	console.log('Error in getting the data')
																	throw err
																})
																.pipe(through2.obj((data, enc, next) => {
																	const writeStream = fs.createWriteStream(filePath)
																	data.content
																		.on('data', (dataFlow) => {
																			downloaded += dataFlow.length
																			observer.next(`Progress: ${filesize(downloaded, {base: 10})}/${filesize(totalDownload, {base: 10})}`)
																		})
																		.on('error', (err) => {
																			console.log('Error in getting the data')
																			throw err
																		})
																		.pipe(writeStream)
																		.on('finish', () => {
																			// spinnerDownloadingFiles.stop()
																			// process.stdout.write('\n')
																			const progressSize = Math.ceil(currentStats.dataDownloaded / stats.totalDownloadSize * 100)
																			const progressCount = Math.ceil(currentStats.filesDownloaded / stats.numberOfSelectedFiles * 100)
																			currentStats.dataDownloaded += file.getFilesize()
																			currentStats.filesDownloaded++
																			const dataDownloadedReadable = filesize(currentStats.dataDownloaded, {base: 10})
																			// process.stdout.write(`-- ${chalk.green(artifactLocation)} - ${chalk.cyan(file.getDisplayName())} download complete.\n`)
																			// process.stdout.write(`Progress: Files downloaded: ${chalk.hsl(progressCount, 50, 50)(currentStats.filesDownloaded)}/${chalk.green(stats.numberOfSelectedFiles)}, ${chalk.hsl(progressSize, 50, 50)(dataDownloadedReadable)}/${chalk.green(filesize(stats.totalDownloadSize, {base: 10}))}.\n`)
																			observer.complete()
																			// resolve()
																		})
																		.on('error', (err) => {
																			console.log('Error in processing the data')
																			throw err
																		})
																}))
																.on('error', (err) => {
																	console.log('Error in retrieving the data')
																	console.log(err)
																	throw err
																})
														})
													}
												}
											)
										})
									})
									.catch((err) => {
										console.log(err)
										rej(err)
									})
									.then(() => {
										res()
									})
							})
							promises.push(p)
						})
					}
					return Promise.all(promises).then(() => {
						return downloads
					})
				})
				.then((downloads) => {
					console.log('all tasks were schedule')
					// console.log(downloads)
					const tasks = new Listr(downloads, {concurrent: threads})
					tasks.run().catch((err) => {
						console.log('Error processing tasks')
						console.log(err)
					})
				})
		}, (error) => {
			spinnerLoadingTomo.stop()
			console.log('Error in getting the metadata of tomograms. OIP must be down.')
			console.error(error.message)
			process.exit(1)
		})
	})
}
