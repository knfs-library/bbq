export const log = (message, allow = false) => {
	if (allow) {
		console.log(`BBQ| ${message}`);
	}
};

export const logError = (message, allow) => {
	if (allow) {
		console.error(`BBQ| ERROR: ${message}`);
	}
};

export const error = (message) => {
	throw new Error(`BBQ| ERROR: ${message}`);
};
