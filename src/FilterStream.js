'use strict'

const Transform = require('stream').Transform

/* Example of rule
	rule = {
		type: "simple",
		searchOn: "microscopist",
		searchType: "contains",
		searchFor: "search string"
	}
*/
module.exports =
class FilterStream extends Transform {
	constructor(rule) {
		super({objectMode: true})
		this.rule = rule
	}

	_transform(chunk, encoding, done) {
		// console.log(chunk.artifact.details[this.rule.searchOn])
		const stringToMatch = chunk.artifact.details[this.rule[0].searchOn]
		if (stringToMatch.match(this.rule[0].parsedRule))
			this.push(chunk)
		done()
	}
}
