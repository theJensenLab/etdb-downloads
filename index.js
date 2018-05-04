#!/usr/bin/env node
'use strict'

const figlet = require('figlet')
const chalk = require('chalk')
const splash = figlet.textSync('ETDB-download', {horizontalLayout: 'fitted'})
console.log(chalk.cyan(splash))
console.log(chalk.hex('#FF6E1E')('\t\t\t\t\t\t\t\t\t     by Jensen Lab'))


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
		help: 'comma separated types of file to be downloaded (TODO)',
		choices: ['TiltSeries', 'Reconstructions', 'Images', 'Videos'],
	}
)

const args = parser.parseArgs()
const queryStack = JSON.parse(fs.readFileSync(args.queryStack))
console.log(chalk.green('Search parameters accepted'))
const app = require('./src/app')
app(queryStack, args.fileType || 'All')
