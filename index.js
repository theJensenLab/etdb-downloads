#!/usr/bin/env node
'use strict'

const pkjson = require('./package.json')
const figlet = require('figlet')
const chalk = require('chalk')
const splash = figlet.textSync(`ETDB-download`, {horizontalLayout: 'fitted'})
console.log(chalk.cyan(splash))
console.log(`\t\t\t\t\t\t\t       ${chalk.cyan("version " + pkjson.version)} ${chalk.hex("#FF6E1E")("by Jensen Lab")}`)


const ArgumentParser = require('argparse').ArgumentParser
const fs = require('fs')

let parser = new ArgumentParser({
	addHelp: true,
	description: 'Command line application to bulk download data from ETDB.'
})

parser.addArgument(
	'queryStack',
	{
		help: 'JSON file with query stack'
	}
)

parser.addArgument(
	'--fileType',
	{
		help: 'comma separated types of file to be downloaded',
		choices: ['TiltSeries', 'Reconstructions', 'Images', 'Videos', 'Others', 'None'],
		nargs: '+'
	}
)

parser.addArgument(
	'--directory',
	{
		help: 'pass the directory name where to download the files',
		nargs: 1
	}
)

parser.addArgument(
	'--threads',
	{
		help: 'number of threads',
		nargs: 1
	}
)

const args = parser.parseArgs()
const queryStack = JSON.parse(fs.readFileSync(args.queryStack))
console.log(chalk.green('Search parameters accepted'))
const app = require('./src/app')
const fileType = args.fileType || 'All'
const directory = (args.directory) ? args.directory[0] : args.directory
const threads = (args.threads) ? parseInt(args.threads[0]) : 1

app(queryStack, fileType, directory, threads)
