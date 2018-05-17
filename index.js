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
		choices: ['TiltSeries', 'Reconstructions', 'Images', 'Movies', 'Others', 'None'],
		nargs: '+'
	}
)

parser.addArgument(
	'--resume',
	{
		help: 'pass teh directory name of the download job you wish to resume',
		nargs: 1
	}
)

const args = parser.parseArgs()
const queryStack = JSON.parse(fs.readFileSync(args.queryStack))
console.log(chalk.green('Search parameters accepted'))
const app = require('./src/app')
const fileType = args.fileType || 'All'
let resume = args.resume
if (resume)
	resume = resume[0]

app(queryStack, fileType, resume)
