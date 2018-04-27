#!/usr/bin/env node
'use strict'

const ArgumentParser = require('argparse').ArgumentParser
const fs = require('fs')

const app = require('./src/app')

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

/* parser.addArgument(
	'fileTypes',
	{
        help: 'comma separated types of file to be downloaded (TODO)',
	}
) */

const rule = [
	{
	type: 'filter',
	searchOn: 'microscopist',
	searchType: 'contains',
	searchFor: 'Gavin Murphy'
	}
]
const args = parser.parseArgs()
const queryStack = JSON.parse(fs.readFileSync(args.queryStack))
console.log(queryStack)
app(queryStack)
