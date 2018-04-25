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
	'searchParameterFile',
	{
		help: 'Search parameter file'
	}
)

/* parser.addArgument(
	'fileTypes',
	{
        help: 'comma separated types of file to be downloaded (TODO)',
	}
) */

const rule = {
	type: 'simple',
	searchOn: 'microscopist',
	searchType: 'contains',
	searchFor: 'Gavin Murphy'
}

const args = parser.parseArgs()
app(args.searchParameterFile)
