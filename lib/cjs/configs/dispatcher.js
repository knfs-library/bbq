
const path = require("path");

module.exports = {
	path: path.resolve(process.cwd(), "bbq"),
	queueConfig: {
		size: 2048,
		expire: 0,
		secretKey: "",
		limit: 0,
		updateMetaTime: 3000
	},
	log: false
}