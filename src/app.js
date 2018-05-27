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
const IPFSFactory = require('ipfsd-ctl')
const IPFSApi = require('ipfs-api')
const Spinner = require('cli-spinner').Spinner

const repoPath = '.ipfsRepo'
const optionsIpfsd = {
	disposable: false,
	start: false,
	repoPath
}

const server = IPFSFactory.createServer()
const node = IPFSFactory.create()

const ipfsDownload = new IPFSApi({
	host: 'gateway.ipfs.io', // 'ipfs.oip.fun',
	port: 443,
	protocol: 'https'
})

const spinnerLoadingTomo = new Spinner(chalk.cyan('Loading tomograms, please wait - ') + chalk.hex('#FF6E1E')('%s'))
spinnerLoadingTomo.setSpinnerString(18)

const OIPJS = require('oip-js').OIPJS
const Core = OIPJS({
	indexFilters: {
		publisher: 'FTSTq8xx8yWUKJA5E3bgXLzZqqG9V6dvnr'
	}
})

const messageSpace = 60

const simpleType2Subtypes = {
	Tiltseries: 'TiltSeries',
	Reconstruction: 'Reconstructions',
	Subvolume: 'Subvolumes',
	Keymov: 'Videos',
	Keyimg: 'Images',
	Snapshot: 'Images',
	Other: 'Others'
}

const ipfsLsRecursive = (ipfsPath) => {
	return new Promise((resolve, reject) => {
		ipfsDownload.ls(ipfsPath)
			.then((lsInfo) => {
				let finalResult = lsInfo
				const dirs = lsInfo.filter((item) => {
					return item.type === 'dir'
				})
				const promises = []
				dirs.forEach((dir) => {
					promises.push(ipfsLsRecursive(dir.path))
				})
				Promise.all(promises)
					.then((results) => {
						results.forEach((result) => {
							result.forEach((entry) => {
								finalResult.push(entry)
							})
						})
						resolve(finalResult)
					})
					.catch((err) => {
						reject(err)
					})
			})
	})
}


const filterExistingFiles = (files, location, localDirectory, ipfs) => {
	return new Promise((resolve, reject) => {
		const promises = []
		ipfsLsRecursive('/ipfs/' + location)
			.then((hashInfoStack) => {
				files.forEach((file) => {
					const fileIpfsPath = '/ipfs/' + location + '/' + file.getFilename()
					const filePath = path.resolve(localDirectory, location, file.getDisplayName())
					const promise = new Promise((res, rej) => {
						if (fs.existsSync(filePath)) {
							return ipfs.api.files.add([{content: fs.createReadStream(filePath)}], {hashOnly: true, rawLeaves: true})
								.then((results) => {
									const hashInfo = hashInfoStack.filter((item) => {
										return item.path === fileIpfsPath
									})
									if (hashInfo.length === 0) {
										console.log(fileIpfsPath)
										console.log(hashInfoStack)
										process.exit()
									}
									const hash = hashInfo[0].hash
									const localFileHash = results[0].hash
									if (hash === localFileHash) {
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
	})
}

const getStats = function(artifacts, fileType, directoryName, ipfs) {
	process.stdout.write(`${chalk.cyan('Checking for already downloaded files...')}\n`)
	return new Promise((resolve, reject) => {
		let stats = {
			totalDownloadSize: 0,
			numberOfSelectedFiles: 0,
			allowedFiles: []
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
				filterExistingFiles(files, artifact.getLocation(), directoryName, ipfs).then((selectedFiles, schedule) => {
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
				results.forEach((files) => {
					files.forEach((file) => {
						stats.allowedFiles.push(file.getFilename())
					})
				})
				resolve(stats)
			})
			.catch((err) => {
				process.stdout.write(`${chalk.red('Something is wrong processing artifacts...')}\n`)
				reject(err)
			})
	})
}

const printMessage = (message, space) => {
	return message + '.'.repeat(space - message.length)
}

const initIfNotThere = (ipfs) => {
	process.stdout.write(chalk.cyan(printMessage('Initializing repository ', messageSpace)))
	return new Promise((resolve, rejects) => {
		if (fs.existsSync(repoPath)) {
			process.stdout.write(chalk.yellow(' found existing repository \n'))
			const apiFileInfo = path.resolve(repoPath, 'api')
			if (fs.existsSync(apiFileInfo))
				fs.unlinkSync(apiFileInfo)
			resolve()
		}
		else {
			ipfs.init({directory: repoPath}, () => {
				process.stdout.write(chalk.green(' OK\n'))
				resolve()
			})
		}
	})
}

module.exports = (queryStack, fileType, resume, threads) => {
	process.stdout.write(chalk.cyan(printMessage('Starting IPFS server ', messageSpace)))
	server.start((err) => {
		if (err) {
			process.stdout.write(chalk.red(' Fail\n'))
			throw err
		}
		process.stdout.write(chalk.green(' OK\n'))
		process.stdout.write(chalk.cyan(printMessage('Spawning a node ', messageSpace)))
		node.spawn(optionsIpfsd, (error, ipfs) => {
			if (error) {
				process.stdout.write(chalk.red(' Fail\n'))
				throw error
			}
			process.stdout.write(chalk.green(' OK\n'))
			initIfNotThere(ipfs)
				.then(() => {
					process.stdout.write(chalk.cyan(printMessage('Starting a node ', messageSpace)))
					ipfs.start((errorr, api) => {
						if (errorr) {
							process.stdout.write(chalk.red(' Fail\n'))
							throw errorr
						}
						process.stdout.write(chalk.green(' OK\n\n'))
						spinnerLoadingTomo.start()
						Core.Index.getArtifacts('*', (artifacts) => {
							spinnerLoadingTomo.stop()
							process.stdout.write('\n')
							const filter = complexFilter(queryStack)
							const selected = artifacts.filter(filter)
							let directoryName = resume || `etdb-download-${Date.now()}`
							getStats(selected, fileType, directoryName, ipfs)
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
												const selectedFiles = files.filter((file) => {
													return stats.allowedFiles.indexOf(file.getFilename()) !== -1
												})

												if (selectedFiles.length !== 0)
													process.stdout.write(`- Dealing with files from tomogram: ${chalk.green(artifactLocation)}\n`)
												selectedFiles.forEach((file) => {
													const ipfsFilePath = artifact.getLocation() + '/' + file.getFilename()
													const filePath = path.resolve(artifactPath, file.getDisplayName())
													const readStream = ipfsDownload.files.getReadableStream(ipfsFilePath)
													downloads.push(
														{
															title: ` ${chalk.green(artifactLocation)} - Download of ${chalk.cyan(file.getDisplayName())} at ${chalk.cyan(artifact.getLocation())}`,
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
																					const progressSize = Math.ceil(currentStats.dataDownloaded / stats.totalDownloadSize * 100)
																					const progressCount = Math.ceil(currentStats.filesDownloaded / stats.numberOfSelectedFiles * 100)
																					currentStats.dataDownloaded += file.getFilesize()
																					currentStats.filesDownloaded++
																					const dataDownloadedReadable = filesize(currentStats.dataDownloaded, {base: 10})
																					observer.complete()
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
												res()
											})
											promises.push(p)
										})
									}
									return Promise.all(promises).then(() => {
										return downloads
									})
								})
								.then((downloads) => {
									const tasks = new Listr(downloads, {concurrent: threads})
									tasks.run()
										.catch((err) => {
											console.log('Error processing tasks')
											console.log(err)
										})
										.then(() => {
											process.stdout.write(chalk.cyan(printMessage('Stopping node ', messageSpace)))
											ipfs.stop((err) => {
												if (err) {
													process.stdout.write(chalk.red(' Fail\n'))
													throw error
												}
												process.stdout.write(chalk.green(' OK\n'))
												process.stdout.write(chalk.cyan(printMessage('Cleaning up ', messageSpace)))
												ipfs.cleanup((err) => {
													if (err) {
														process.stdout.write(chalk.red(' Fail\n'))
														throw err
													}
													process.stdout.write(chalk.green(' OK\n'))
													process.stdout.write(chalk.cyan(printMessage('Stopping the server ', messageSpace)))
													server.stop((err) => {
														if (err) {
															process.stdout.write(chalk.red(' Fail\n'))
															throw err
														}
														process.stdout.write(chalk.green(' OK\n'))
														process.stdout.write(chalk.cyan('Exiting with elegance\n'))
														process.exit(0)
													})
												})

											})

										})
								})
						}, (error) => {
							spinnerLoadingTomo.stop()
							console.log('Error in getting the metadata of tomograms. OIP must be down.')
							console.error(error.message)
							process.exit(1)
						})
					})
				})
		})
	})
}
