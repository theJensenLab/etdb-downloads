'use strict'

const stream = require('stream')
const through2 = require('through2')

const FilterStream = require('./FilterStream')
const parseRules = require('./parseRules')

const OIPJS = require('oip-js').OIPJS
const Core = OIPJS({
	OIPdURL: 'https://snowflake.oip.fun/alexandria/v2',
	artifactFilters: [
		function(artifact) {
			if (artifact.getType() === 'Research' && artifact.getSubtype() === 'Tomogram')
				return true
			return false
		},
		function(artifact) {
			if (artifact.getMainAddress() === 'FTSTq8xx8yWUKJA5E3bgXLzZqqG9V6dvnr')
				return true
			return false
		}]
})

module.exports = (rulesFileName) => {
	const rule = parseRules(rulesFileName)
	Core.Index.getSupportedArtifacts((artifacts) => {
		console.log(artifacts.length)

		const artifactStream = new stream.Readable({objectMode: true})
		artifacts.map((artifact) => {
			artifactStream.push(artifact)
		})
		artifactStream.push(null)

		const filter = new FilterStream(rule)

		artifactStream.pipe(filter).pipe(through2.obj((chunk, enc, done) => {
			console.log(JSON.stringify(chunk.artifact.details, null, ' '))
			done()
		}))
	}, (error) => {
		console.error(error)
	})
}

