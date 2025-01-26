/**
 * @author Kent Phung
 * @email daikhanh9260@gmail.com
 * @version 1.0.2
 * @license MIT
 * @link https://github.com/knfs-library/bbq
 */
/**
 * @module BBQ
 * A lightweight and efficient job queuing system designed to integrate directly on local files of Node.js applications. 
 * With built-in support for job management, workers, and message handling, BBQ helps you streamline asynchronous task execution and improve the performance of your applications.
 */
/**
 * Queue Type
 * @typedef {{id: string, size: number, path: string, createdAt: number}} MessageType
 *
 * @typedef {{size: number, expire: number, secretKey: string, updateMetaTime: number, log:bool}} OptionQueueDefaultType
 * @typedef {{path: string, queueOption: OptionQueueDefaultType, log: bool}} ConfigType
 *
 * @typedef {{worker: string, order: number, retry: number, timeout: number, retryAfter: number}} JobOption
 * @typedef {{name: string, callback: function, options: JobOption}} JobType
 *
 * @typedef {{log: bool, priority: number, intervalRunJob: number}} WorkerOptionsType
 *
 */
/**
 * @typedef {Object} OptionQueueType
 * @property {number} size - The maximum size allowed, in bytes.
 * @property {number} expire - The expiration time in seconds.
 * @property {boolean} log - Whether logging is enabled (true/false).
 * @property {number} limit - The maximum number of items allowed.
 * @property {string} secretKey - The secret key used for securing the system.
 * @property {number} updateMetaTime - The interval to update metadata, in seconds.
 * @property {number} rebroadcastTime - The rebroadcast time when jobs are processed by full message
 */
/**
 *  @typedef {Object} QueueType
 * @property {string} id
 * @property {string} name
 * @property {function(message: MessageValueType)} broadcast
 * @property {function(): OptionQueueType} getOption
 */
/**
 * @typedef {Object} MessageValueType
 * @property {string} id - The ID of the message.
 * @property {number} size - The size of the message in bytes.
 * @property {string} path - The storage path of the message.
 * @property {number} createdAt - The creation timestamp of the message.
 * @property {number | null} failedAt - The failed timestamp of the message.
 * @property {number} failedCount
 * @property {string | Object |number} value
 */

const Queue = require("./queue")
const fs = require("fs-extra");
const path = require("path");
const { log: logFunc, error: errorFunc } = require("./utils/log")
const workerDefault = require("./configs/worker")
const queueDefault = require("./configs/queue")
/**
 * @type {ConfigType}
 */
const configDefault = require("./configs/dispatcher")
const crypto = require("crypto");
const Worker = require("./worker")
const METADATA_FILE = 'metabbq.json';

class Dispatcher {

	/**
	 * 
	 * @type {OptionType}
	 */
	#config;

	/**
	 * @type {Map}
	 */
	#queues = {}

	/**
	 * @type {Array<Worker>}
	 */
	#workers = [] 

	constructor(config = configDefault) {
		this.#config = { ...configDefault, ...config }
		this.#config.queueOption = { ...configDefault.queueOption, ...config.queueOption}

		this.#queues = new Map()

		logFunc(`Start`, true)
	}

	/**
	 * Get Queues
	 * @returns {Map}
	 */
	getQueues() {
		return this.#queues;
	}

	/**
	 * Get Workers
	 * @returns {Array<Worker>}
	 */
	getWorkers() {
		return this.#workers;
	}

	/**
	 * 
	 * @param {string} name 
	 * @param {OptionQueueType} options 
	 * 
	 * @return {Promise<Queue>}
	 */
	async createQueue(name, options = {
		size: queueDefault.size,
		expire: queueDefault.expire,
		limit: queueDefault.limit,
		log: false
	}) {
		for (const queue of this.#queues.values()) {
			if (queue.name == name) {
				return queue
			}
		}

		const queueOptions = {
			...this.#config.queueOption,
			...options,
			log: options.log ? options.log : this.#config.log,
		}

		let pathQueue = path.resolve(this.#config.path, crypto.createHash("md5").update(name).digest("hex"));
		const queue = new Queue(name, pathQueue, this, queueOptions)
		await queue.setup()
		this.#queues.set(queue.id, queue)
		logFunc(`Queue ${name} created`, this.#config.log)
		await this.#updateMetadata()

		return queue
	}

	/**
	 * @param {string} name 
	 * 
	 * @returns {Queue}
	 */
	getQueue(name) {
		for (const queue of this.#queues.values()) {
			if (queue.name === name) {
				return queue
			}
		}

		errorFunc(`Queue ${name} not exist`)
	}

	/**
	 * @param {string} queueId 
	 * 
	 * @returns {Queue}
	 */
	getQueueById(queueId) {
		if (!this.#queues.has(queueId)) {
			errorFunc(`Queue ${id} not exist`)
		}
		return this.#queues.get(queueId)
	}

	/**
	 * Delete Queue
	 * 
	 * @param {string} name 
	 */
	async deleteQueue(name) {
		let findQueue = null
		for (const queue of this.#queues.values()) {
			if (queue.name === name) {
				findQueue = queue
				break;
			}
		}

		if (!findQueue) {
			errorFunc(`Queue ${name} not exist`)
		}
	
		try {
			await fs.remove(findQueue.path);
			logFunc(`Delete Queue Path: ${findQueue.path}`, this.#config.log)
			this.#queues.delete(findQueue.id)
			logFunc(`Delete Queue: ${findQueue.name}`, this.#config.log)
			await this.#updateMetadata()
		} catch (err) {
			errorFunc(`Error removing folder:, ${err.message}`)
		}
	}


	/**
	 * Get All Queues
	 * @returns 
	 */
	getQueues() {
		return this.#queues
	}

	/**
	 * 
	 * @param {string} name 
	 * @param {WorkerOptionsType} options 
	 */
	createWorker(name, options = workerDefault.options) {
		const defaultOptions = workerDefault.options
		const workerOptions = {
			...defaultOptions,
			...options,
			log: options.log ? options.log : this.#config.log
		}
		const iExistWorker = this.#workers.findIndex(nWorker => nWorker.name === name)

		if (-1 < iExistWorker) {
			errorFunc("Worker Name Duplicate!")
		}
		const worker = new Worker(name, workerOptions, this)
		this.#workers.push(worker)
		this.#workers.sort((a, b) => b.priority - a.priority)

		logFunc(`Worker ${name} created`, this.#config.log)

		return worker
	}

	/**
	 * @param {string} name 
	 * 
	 * @returns {Worker}
	 */
	getWorker(name) {
		const existWorker = this.#workers.find(nWorker => nWorker.name === name)
		if (!existWorker) {
			errorFunc(`Worker ${name} not exist!`)
		}

		return existWorker
	}

	/**
	 * Listen event form queue
	 * 
	 * @param {String} queueId 
	 * @param {MessageValueType} message
	 */
	listen(queueId, message) {
		let ran = false
		/**
		 * @type {QueueType}
		 */
		const queue = this.getQueueById(queueId)
		for (const worker of this.#workers) {
			if (worker.existObserverQueue(queue.id)) {
				logFunc(`Selected Worker is ${worker.name}`, this.#config.log);
				worker.run(queue, message)
				ran = true;
				break;
			}
		}

		if (!ran) {
			logFunc(`Valid Worker Not Found`);
			setTimeout(async () => {
				logFunc(`Rebroadcast with message: ${message.id}`, this.#config.log);
				await queue.broadcast(message)
			}, queue.getOption().rebroadcastTime)
		}

	}

	/**
	 * Setup the cache folder and initialize metadata.
	 * Ensures the cache directory exists, restores metadata if available, and schedules message expiry.
	 *
	 * @returns {Promise<void>}
	 */
	async setup() {
		const metadataPath = path.resolve(this.#config.path, METADATA_FILE);
		await fs.ensureDir(this.#config.path)
			.then(() => {
				logFunc(`Metadata written to ${metadataPath}`, this.#config.log);
			})
			.catch((err) => {
				errorFunc(err)
			})
			.finally(async () => {
				let metadata = {}
				// check metadata exist
				if (fs.existsSync(metadataPath)) {
					metadata = await fs.readJSON(metadataPath)

					if (metadata.queues && metadata.queues.length) {
						for (const queue of metadata.queues) {
							await this.#applyQueue(queue.name, queue.id, queue.path, queue.options)
						}
					}
				}

				const queueArr = Array.from(this.#queues.values())
				metadata = {
					...metadata,
					queues: queueArr.length ? (queueArr).map((queue) => {
						return {
							path: queue.getPath(),
							name: queue.name,
							options: queue.getOption(),
							id: queue.id
						}
					}) : [],
					createdAt: new Date().getTime(),
					path: this.#config.path,
					secret: this.#config.queueOption.secretKey != "" ? true : false,
					log: this.#config.log
				};
				try {
					await fs.writeJSON(metadataPath, metadata);
					logFunc(`Metadata BBQ written to ${metadataPath}`, this.#config.log);
				} catch (error) {
					errorFunc(error)

				}
			});
	}

	/**
	 * 
	 * @param {string} name 
	 * @param {string} id 
	 * @param {string} pathQueue 
	 * @param {OptionQueueType} options 
	 * 
	 */
	async #applyQueue(name, id, pathQueue, options = {
		size: queueDefault.size,
		expire: queueDefault.expire,
		limit: queueDefault.limit
	}) {
		for (const queue of this.#queues.values()) {
			if (queue.name === name) {
				errorFunc(`Queue with name "${name}" duplicate.`);
			}
		}

		const queueOptions = {
			...this.#config.queueOption,
			log: this.#config.log,
			...options,
			updateMetaTime: Math.max(1000, this.#config.queueOption)
		}

		const queue = new Queue(name, pathQueue, this, queueOptions)
		queue.id = id
		this.#queues.set(queue.id, queue)
		await queue.setup()

		logFunc(`Queue ${name} applied`, this.#config.log)
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
		const metadataPath = path.resolve(this.#config.path, METADATA_FILE);
		const metadata = await fs.readJSON(metadataPath)
		const queueArr = Array.from(this.#queues.values())
		metadata.queues = queueArr.length ? queueArr.map((queue) => {
			return {
				path: queue.getPath(),
				name: queue.name,
				options: queue.getOption(),
				id: queue.id
			}
		}) : []
		await fs.writeJSON(metadataPath, metadata)
			.then(() => {
				logFunc(`Updated Dispatcher Metadata`, this.#config.log);
			})
			.catch((err) => {
				errorFunc(`Updated Dispatcher Metadata Error: ${err}`);
			});
	}
}

module.exports = Dispatcher

