
const crypto = require("crypto");
const fs = require("fs-extra");
const path = require("path");
const { log: logFunc, error: errorFunc } = require("./utils/log")
const optionsDefault = require("./configs/queue")

const algorithm = 'aes-256-ecb';

/**
 * @typedef {Object} MessageType
 * @property {string} id - The ID of the message.
 * @property {number} size - The size of the message in bytes.
 * @property {string} path - The storage path of the message.
 * @property {number} createdAt - The creation timestamp of the message.
 * @property {number | null} failedAt - The failed timestamp of the message.
 * @property {number} failedCount - The number of failures of message
 */

/**
 * @typedef {Object} MessageValueType
 * @property {string} id - The ID of the message.
 * @property {string} queueId - The ID of the queue.
 * @property {number} size - The size of the message in bytes.
 * @property {string} path - The storage path of the message.
 * @property {number} createdAt - The creation timestamp of the message.
 * @property {number | null} failedAt - The failed timestamp of the message.
 * @property {number} failedCount
 * @property {string | Object |number} value
 */

/**
 * @typedef {Object} OptionType
 * @property {number} size - The maximum size allowed, in bytes.
 * @property {number} expire - The expiration time in seconds.
 * @property {boolean} log - Whether logging is enabled (true/false).
 * @property {number} limit - The maximum number of items allowed.
 * @property {string} secretKey - The secret key used for securing the system.
 * @property {number} updateMetaTime - The interval to update metadata, in seconds.
 * @property {number} rebroadcastTime - The rebroadcast time when jobs are processed by full message
 */


const METADATA_FILE = 'metaq.json';

class Queue {

	/**
	 * Handle expire time data
	 * 
	 * @private
	 * @type {Map}
	 */
	#timers = null;

	/**
	 * Handle expire time data
	 * 
	 * @private
	 */
	#updateMetaTimer = null;


	/**
	 * 
	 * Contains messages that have been added to the queue
	 * 
	 * @private
	 * @type {Array<MessageType>}
	 */
	#pipeline = []

	/**
	 * But the messages are processed but fail
	 * 
	 * @private
	 * @type {Array<MessageType>}
	 */
	#fails = []

	/**
	 * Queue options
	 * 
	 * @private
	 * @type {OptionType}
	 */
	#options

	/**
	 * Path to the queue's storage resource
	 * 
	 * @type {String}
	 */
	path = ""

	/**
	 * Management dispatcher information
	 * 
	 * @type {Object}
	 */
	#dispatcher = null

	/**
	 * @constructor
	 * @param {string} name - The name of the queue.
	 * @param {string} path - The file path for the queue storage.
	 * @param {Object} dispatcher - The name of the queue.
	 * @param {OptionType} options - Config for the queue.
	 */
	constructor(name, path, dispatcher, options = optionsDefault) {
		this.#timers = new Map();
		this.name = name;
		this.#options = { ...optionsDefault, ...options };
		this.path = path;

		/**
		 * @type {String}
		 */
		this.id = crypto.randomUUID()

		this.#dispatcher = dispatcher
	}

	/**
	 * 
	 * @param {MessageValueType} message 
	 */
	async broadcast(message) {
		this.#dispatcher.listen(this.id, message)
	}

	/**
	 * Report all content in the queue to jobs that are on
	 * 
	 * @param {bool} withMessageFail 
	 */
	async reBroadCast(withMessageFail = false) {
		this.#log(`Rebroadcast Queue: ${this.name}`)
		for (const message of this.#pipeline) {
			if (!message.path) {
				continue
			}

			let value = await fs.readFile(path.resolve(this.path, message.path), "utf8");
			await this.broadcast({
				...message,
				queueId: this.id,
				value: this.#decrypt(value, message.type)
			})
		}

		if (withMessageFail) {
			for (const message of this.#fails) {
				if (!message.path) {
					continue
				}

				let value = await fs.readFile(path.resolve(this.path, message.path), "utf8");
				await this.broadcast({
					...message,
					queueId: this.id,
					value: this.#decrypt(value, message.type)
				})
			}
		}
		
	}
	

	/**
	 * Add a message to the queue.
	 * @param {*} message - The message content to be added.
	 * @throws Will throw an error if the message size exceeds limits or if the queue is full.
	 */
	async addMessage(message) {

		if (0 < this.#options.limit && this.#pipeline.length + 1 > this.#options.limit) {
			errorFunc(`The size of the message has reached its limit at Queue ${this.name}`)
			return
		}

		const type = typeof message;

		if ('undefined' == type) {
			errorFunc(`Message is undefined at Queue ${this.name}`)
			return
		}

		message = this.#formatMessage(message, type)

		const sizeInBytes = Buffer.byteLength(message, 'utf8');

		if (sizeInBytes > this.#options.size) {
			const f10 = message.slice(0, 10);
			const l10 = message.slice(-10);
			errorFunc(`Message size is over at queue ${this.name}: ${f10}...${l10}`)
			return
		}

		const msgData = {
			id: crypto.randomUUID(),
			size: sizeInBytes,
			path: '',
			createdAt: new Date().getTime(),
			failedAt: null,
			failedCount: 0,
			type
		}

		let fileName = crypto.createHash("md5").update(msgData.id).digest("hex");
		const filePath = `msgs/${fileName}.knmbbq`;

		msgData.path = filePath

		message = this.#encrypt(message)

		await fs.outputFile(path.resolve(this.path, filePath), message)
			.then(async () => {
				this.#log(`Add Message: ${msgData.id}`);

				if (0 < this.#options.expire) {
					this.#deleteAfterTimeout(msgData.id, this.#options.expire);
				}

				this.#pipeline.push(msgData);
				this.#pipeline.sort((a, b) => a.createdAt - b.createdAt)

				await this.broadcast({
					...msgData,
					queueId: this.id,
					value: this.#decrypt(message, type)
				})

				await this.#updateMetadata()
			})
			.catch((err) => {
				errorFunc(err.message)
			});
	}

	/**
	 * Get information fail message
	 * 
	 * @param {string} messageId 
	 * @returns 
	 */
	async getFail(messageId) {
		const message = this.#fails.find(msg => msg.id == messageId);
		if (!message) {
			return null
		}

		this.#fails = this.#fails.filter(msg => msg.id != message.id);
		
		let value = await fs.readFile(path.resolve(this.path, message.path), "utf8");

		return {
			...message,
			value: this.#decrypt(value, message.type)
		}
	}

	/**
	 * Mark a message as failed.
	 * @param {string} messageId - The ID of the message to mark as failed.
	 * @throws Will throw an error if the messageId is invalid.
	 */
	async fail(messageId) {
		let message = this.#fails.find(msg => msg.id == messageId);
		if (message) {
			return message;
		}

		message = this.#pipeline.find(msg => msg.id == messageId)
		this.#pipeline = this.#pipeline.filter(msg => msg.id != messageId);

		if (message) {
			message.failedAt = (new Date()).getTime();
			message.failedCount += 1;
			this.#fails.push(message);
			this.#fails.sort((a, b) => a.createdAt - b.createdAt);
			await this.#updateMetadata();
		}

		return message;
	}

	/**
	 * Mark a message as processed and remove it from the queue.
	 * @param {string} messageId - The ID of the message to mark as done.
	 * @throws Will throw an error if the messageId is invalid.
	 */
	async done(messageId) {
		if (!messageId) {
			return;
		}
		this.#deleteAfterTimeout(messageId, 1000)
	}

	/**
	 * Setup the cache folder and initialize metadata.
	 * Ensures the cache directory exists, restores metadata if available, and schedules message expiry.
	 *
	 * @returns {Promise<void>}
	 */
	async setup() {
		await fs.ensureDir(this.path)
			.then(() => {
				this.#log(`Setup folder: ${this.path}`);
			})
			.catch((err) => {
				errorFunc(err)
			})
			.finally(async () => {
				const metadataPath = path.resolve(this.path, METADATA_FILE);
				let metadata = {}
				// check metadata exist
				if (fs.existsSync(metadataPath)) {
					// update options with metadata current
					metadata = await fs.readJSON(metadataPath)

					// Handle expired messages
					const currentDate = new Date().getTime();
					if (metadata.pipeline && metadata.pipeline.length) {
						this.#pipeline = metadata.pipeline
						for (const [key, value] of Object.entries(metadata.pipeline)) {
							if (metadata.expire > 0) {
								const diff = metadata.expire - (currentDate - value.createdAt)
								const expireT = diff > 0 ? diff : 1;
								this.#deleteAfterTimeout(key, expireT)
							}
						}
					}

					if (metadata.fails && metadata.fails.length) {
						this.#fails = metadata.fails
						for (const [key, value] of Object.entries(metadata.fails)) {
							if (metadata.expire > 0) {
								const diff = metadata.expire - (currentDate - value.createdAt)
								const expireT = diff > 0 ? diff : 1;
								this.#deleteAfterTimeout(key, expireT)
							}
						}
					}
				}

				metadata = {
					fails: this.#fails,
					pipeline: this.#pipeline,
					id: this.id,
					name: this.name,
					createdAt: new Date().getTime(),
					path: this.path,
					size: this.#options.size,
					expire: this.#options.expire,
					limit: this.#options.limit,
					secret: this.#options.secretKey != "" ? true : false,
				};
				try {
					await fs.writeJSON(metadataPath, metadata);
					this.#log(`Metadata written to ${metadataPath}`);
					await this.reBroadCast(true);

				} catch (error) {
					errorFunc(error)

				}
			});
	}

	/**
	 * Get the current pipeline of messages.
	 * @returns {Array<MessageType>}
	 */
	getPipeline() {
		return this.#pipeline;
	}

	/**
	 * Get the failed messages.
	 * @returns {Array<MessageType>}
	 */
	getFails() {
		return this.#fails;
	}

	/**
	 * Get the file path for the queue.
	 * @returns {string}
	 */
	getPath() {
		return this.path;
	}

	/**
	 * Get the optionsuration for the queue.
	 * @returns {OptionType}
	 */
	getOption() {
		return this.#options;
	}

	/**
	 * Get the timers for message expiry.
	 * @returns {Map}
	 */
	getTimers() {
		return this.#timers;
	}

	/**
	 * Updates metadata for a specific id.
	 *
	 * @param {String} id - The id to update.
	 * @param {String} filePath - Path to the file.
	 * @param {OptionsMetadata} options - Cache options.
	 * @private
	 */
	async #updateMetadata() {
		if (this.#updateMetaTimer) {
			clearTimeout(this.#updateMetaTimer)
		}
		this.#updateMetaTimer = setTimeout(async () => {
			const metadataPath = path.resolve(this.path, METADATA_FILE);
			let metadata = {}
			try {
				metadata = await fs.readJSON(metadataPath)
			} catch (error) {
				metadata = await fs.readFile(metadataPath, 'utf8')
				metadata = JSON.parse(metadata)
			}

			metadata.pipeline = this.#pipeline
			metadata.fails = this.#fails

			await fs.writeJSON(metadataPath, metadata)
				.then(() => {
					this.#log(`Updated Metadata Queue ${this.name}`);
				})
				.catch((err) => {
					errorFunc(`Update Queue MetaData ${this.name} Error: ${err.message}`)
				});
		}, this.#options.updateMetaTime)
	}

	/**
	 * Deletes a file after a timeout.
	 *
	 * @param {String} key - The key to delete metadata for.
	 * @param {Number} timeout - Timeout in milliseconds.
	 * @private
	 */
	#deleteAfterTimeout(key, timeout) {
		// check timeout in timers and clear if it
		if (this.#timers.has(key)) {
			clearTimeout(this.#timers.get(key));
			this.#timers.delete(key);
		}

		// clear new timeout
		const timer = setTimeout(async () => {
			try {
				let message = this.#pipeline.find(msg => msg.id == key)
				if (message) {
					this.#pipeline = this.#pipeline.filter(msg => msg.id != key);
					await fs.remove(path.resolve(this.path, message.path));
				} else {
					message = this.#fails.find(msg => msg.id == key)
					if (message) {
						this.#fails = this.#fails.filter(msg => msg.id != key);
						this.#deleteAfterTimeout(message.id, 1000)
						this.#log(`Deleted fails: ${key}`);
						await fs.remove(path.resolve(this.path, message.path));
					}
				}

				this.#log(`Deleted message: ${key}`);
				this.#timers.delete(key); // delete
				await this.#updateMetadata()
			} catch (err) {
				errorFunc(err)
			}
		}, timeout);

		//save id of timeout
		this.#timers.set(key, timer);
	}

	/**
	 * Encrypt message with secretKey
	 * 
	 * @private
	 * @param {String} message
	 */
	#encrypt(message) {
		if ("" == this.#options.secretKey) {
			return message
		}

		const key = this.#padKey(this.#options.secretKey)
		const cipher = crypto.createCipheriv(algorithm, key, null);
		let encrypted = cipher.update(message, 'utf8', 'hex');
		encrypted += cipher.final('hex');

		return encrypted
	}

	/**
	 * Decrypt message with secretKey
	 * 
	 * @private
	 * @param {String} encryptedMessage
	 * 
	 * @param {String} type - "Number" | "String" | "Object" 
	 */
	#decrypt(encryptedMessage, type) {
		if ("" == this.#options.secretKey) {
			return this.#reformatMessage(encryptedMessage, type)
		}

		const key = this.#padKey(this.#options.secretKey)

		const decipher = crypto.createDecipheriv(algorithm, key, null);
		let decrypted = decipher.update(encryptedMessage, 'hex', 'utf8');
		decrypted += decipher.final('utf8');

		return this.#reformatMessage(decrypted, type);
	}

	/**
	 *generate format key form secretKey
	 *  
	 * @param {*} key 
	 * @returns 
	 */
	#padKey(key) {
		if (key.length > 32) {
			return key.slice(0, 32);
		} else {
			return key.padEnd(32, '0');
		}
	}

	/**
	 * Format message
	 * 
	 * @param {*} message 
	 * @param {String} type - "Number" | "String" | "Object" 
	 * 
	 * @returns {String}
	 */
	#formatMessage(message, type = "string") {
		switch (type) {
			case "object":
				return JSON.stringify(message)
			default:
				return String(message)
		}
	}

	/**
	 * Format message
	 * 
	 * @param {String} formatMessage 
	 * @param {String} type - "number" | "string" | "object" 
	 * 
	 * @returns {Object | number | string}
	 */
	#reformatMessage(formatMessage, type = "string") {
		switch (type) {
			case "object":
				return JSON.parse(formatMessage)
			case "number":
				return Number(formatMessage)
			default:
				return String(formatMessage)
		}
	}

	/**
	 * Logs messages if logging is enabled.
	 *
	 * @param {String} message - The message to log.
	 * @private
	 */
	#log(message) {
		logFunc(message, this.#options.log)
	}
}

module.exports = Queue