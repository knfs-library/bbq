
const path = require("path");
const scheduleJob = require("./schedule-job");

module.exports = {
	path: path.resolve(process.cwd(), "bbq"),
	queueConfig: {
		size: 2048,
		expire: 0,
		secretKey: "",
		limit: 0,
		updateMetaTime: 3000,
		rebroadcastTime: 2000, 
	},
	log: false
}