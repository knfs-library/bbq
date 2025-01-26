
module.exports = {
	log: (message, allow = false) => {
		if (allow) {
			console.log(`BBQ| ${message}`)
		}
	},
	logError: (message, allow) => {
		if (allow) {
			console.error(`BBQ| ERROR: ${message}`)
		}
	},
	error: (message) => {
		throw new Error(`BBQ| ERROR: ${message}`)
	}
}