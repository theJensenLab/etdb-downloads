'use strict'

const fs = require('fs')

module.exports = (ruleFileName) => {
	const rules = JSON.parse(fs.readFileSync(ruleFileName))
	const parsedRules = []
	rules.map((rule) => {
		if (rule.type === 'simple') {
			const start = rule.searchType === 'startsWith' || rule.searchType === 'exact' ? '^' : ''
			const end = rule.searchType === 'endsWith' || rule.searchType === 'exact' ? '$' : ''
			rule.parsedRules = start + rule.searchFor + end
			parsedRules.push(rule)
		}
	})
	return parsedRules
}
