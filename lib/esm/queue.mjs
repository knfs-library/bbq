import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { log as logFunc, error as errorFunc } from './utils/log.mjs';
import optionsDefault from './configs/queue.mjs';

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
 * @property {string | Object | number} value
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
	 * Queue optionsuration
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
			});

		// Create cache metadata file
		await fs.outputFile(path.resolve(this.path, METADATA_FILE), JSON.stringify({ pipeline: [], fails: [] }))
			.then(() => {
				this.#log(`Setup metadata file: ${path.resolve(this.path, METADATA_FILE)}`);
			})
			.catch((err) => {
				errorFunc(err)
			});

		// Restore metadata
		this.#restoreMetadata()

		// Set timer for metadata updates
		if (0 < this.#options.updateMetaTime) {
			this.#updateMetaTimer = setInterval(() => {
				this.#updateMetadata()
			}, this.#options.updateMetaTime * 1000);
		}
	}

	/**
	 * Delete message after timeout
	 * 
	 * @private
	 * @param {string} messageId 
	 * @param {number} timeout
	 */
	#deleteAfterTimeout(messageId, timeout) {
		this.#timers.set(messageId, setTimeout(() => {
			this.#removeMessage(messageId);
		}, timeout * 1000));
	}

	/**
	 * Remove message from queue
	 * 
	 * @private
	 * @param {string} messageId 
	 */
	#removeMessage(messageId) {
		this.#pipeline = this.#pipeline.filter(msg => msg.id != messageId);
		this.#fails = this.#fails.filter(msg => msg.id != messageId);
		this.#log(`Deleted message: ${messageId}`)
	}

	/**
	 * Update metadata file
	 * 
	 * @private
	 */
	async #updateMetadata() {
		await fs.outputFile(path.resolve(this.path, METADATA_FILE), JSON.stringify({
			pipeline: this.#pipeline,
			fails: this.#fails,
		}));
		this.#log(`Metadata updated at ${new Date().getTime()}`);
	}

	/**
	 * Restore metadata from the file
	 * 
	 * @private
	 */
	async #restoreMetadata() {
		const metaPath = path.resolve(this.path, METADATA_FILE);
		if (await fs.pathExists(metaPath)) {
			const data = await fs.readFile(metaPath, 'utf8');
			const metaData = JSON.parse(data);
			this.#pipeline = metaData.pipeline;
			this.#fails = metaData.fails;
			this.#log(`Metadata restored from ${metaPath}`);
		} else {
			this.#log(`No metadata file found.`);
		}
	}

	/**
	 * Encrypt message with secretKey
	 * 
	 * @private
	 * @param {String} message
	 * @returns {String} - The encrypted message.
	 */
	#encrypt(message) {
		if (this.#options.secretKey === "") {
			return message;
		}

		const key = this.#padKey(this.#options.secretKey);
		const cipher = crypto.createCipheriv(algorithm, key, null);
		let encrypted = cipher.update(message, 'utf8', 'hex');
		encrypted += cipher.final('hex');
		return encrypted;
	}

	/**
	 * Decrypt message with secretKey
	 * 
	 * @private
	 * @param {String} message
	 * @param {String} type - The type of the message.
	 */
	#decrypt(message, type) {
		if (this.#options.secretKey === "") {
			return message;
		}

		const key = this.#padKey(this.#options.secretKey);
		const decipher = crypto.createDecipheriv(algorithm, key, null);
		let decrypted = decipher.update(message, 'hex', 'utf8');
		decrypted += decipher.final('utf8');

		// Handle different message types (e.g., JSON, string, etc.)
		if (type === 'string') {
			return decrypted;
		}
		try {
			return JSON.parse(decrypted);
		} catch (e) {
			return decrypted;
		}
	}

	/**
	 * Pads the secret key to fit the AES block size.
	 * 
	 * @private
	 * @param {string} key - The secret key.
	 * @returns {string} - The padded key.
	 */
	#padKey(key) {
		// Ensure the key length is exactly 32 bytes for AES-256
		const paddedKey = Buffer.from(key);
		const keyLength = 32; // AES-256 block size
		if (paddedKey.length < keyLength) {
			return Buffer.concat([paddedKey, Buffer.alloc(keyLength - paddedKey.length)]);
		}
		return paddedKey.slice(0, keyLength);
	}

	/**
	 * Format the message for storage in the queue.
	 * 
	 * @private
	 * @param {any} message - The message to format.
	 * @param {string} type - The type of the message.
	 * @returns {string} - The formatted message.
	 */
	#formatMessage(message, type) {
		if (type === 'object' || type === 'function') {
			try {
				// Convert objects to a string format (JSON) for consistency
				return JSON.stringify(message);
			} catch (e) {
				errorFunc(`Error formatting message: ${e.message}`);
				return '';
			}
		}
		// Return the message as is if it's not an object
		return message.toString();
	}

	/**
	 * Logs messages when enabled in the options.
	 * 
	 * @private
	 * @param {string} message - The message to log.
	 */
	#log(message) {
		if (this.#options.log) {
			logFunc(`${this.name}: ${message}`);
		}
	}
}

export default Queue;
