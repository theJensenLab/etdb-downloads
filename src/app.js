'use strict'

const stream = require('stream')
const through2 = require('through2')

const complexFilterStream = require('complex-filter-stream')

const OIPJS = require('oip-js').OIPJS
const Core = OIPJS({
	OIPdURL: 'https://snowflake.oip.fun/alexandria/v2',
	indexFilters: {
		publisher: 'FTSTq8xx8yWUKJA5E3bgXLzZqqG9V6dvnr'
	}
})

module.exports = (queryStack) => {
	Core.Index.getSupportedArtifacts((artifacts) => {
		console.log(artifacts.length)

		const artifactStream = new stream.Readable({objectMode: true})

		artifactStream._read = () => {}

		artifacts.map((artifact, i) => {
			artifactStream.push(artifact)
			if (i + 1 === artifacts.length)
				artifactStream.push(null)
		})


		const filter = complexFilterStream(queryStack)

		artifactStream
			.pipe(filter)
			.pipe(through2.obj((chunk, enc, done) => {
				console.log(JSON.stringify(chunk.artifact.details, null, ' '))
				done()
			}))
		artifacts.push(null)
	}, (error) => {
		console.error(error)
	})
}

