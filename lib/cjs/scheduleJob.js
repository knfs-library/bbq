const crypto = require("crypto")
const jobOptionDefault = require("./configs/schedule-job")
const { log: logFunc, error: errorFunc, logError: logErrorFunc } = require("./utils/log")
const { Worker: SysWorker } = require('worker_threads');
const path = require("path")

/**
 * @typedef {Object} MessageValueType
 * @property {string | Object |number} value
 */

/**
 *  @typedef {Object} WorkerType
 * @property {string} id
 * @property {string} name
 * @property {function(jobName: string, jobId: string, type: string)} downInstance
 */
class ScheduleJob {
	/**
	 * @type {SysWorker}
	 */
	#mainWorker

	/**
	 * @type {jobOptionDefault}
	 */
	#options

	/**
	 * @type {*}
	 */
	#sampleData

	/**
	 * @type {function|string}
	 */
	#callback 

	/**
	 * @type {number}
	 */
	#tried = 0

	/**
	 * @constructor
	 * @param {string} name 
	 * @param {WorkerType} worker 
	 * @param {*} sampleData 
	 * @param {string | function} callback 
	 * @param {jobOptionDefault} options 
	 */
	constructor(
		name,
		worker,
		sampleData,
		pattern,
		callback,
		options = jobOptionDefault
	) {
		/**
		 * @type {string} 
		 */
		this.id = crypto.randomUUID();
		/**
		 * @type {string} 
		 */
		this.name = name;
		/**
		 * @type {WorkerType} 
		 */
		this.worker = worker;
		/**
		 * @type {*}
		 */
		this.#sampleData = sampleData

		this.schedulePattern = pattern

		this.#callback = callback
		this.#options = { ...jobOptionDefault, ...options }

		this.#mainWorker = new SysWorker(path.resolve(__dirname, 'workers/run-job.worker.js'), { captureRejections: true })
		this.#mainWorker.setMaxListeners(this.#options.maxListeners);
	}

	/**
	 * Set options for the job.
	 * @param {jobOptionDefault} options 
	 */
	setOptions(options) {
		this.#options = { ...this.#options, ...options };
	}

	/**
	 * 
	 * @returns 
	 */
	getMainWorker() {
		return this.#mainWorker
	}

	/**
	 * Try handle message
	 * 
	 * @param {string} type - is try or retry
	 * @returns 
	 */
	async try(type = "try") {
	
		logFunc(`Run Schedule Job at ${this.name} - ${this.id}, state: ${type}`, this.#options.log);

		this.#tried += 1;

		function isValidFullPath(fullPath) {
			const regex = /\/.*\.(js|mjs|ts)$/; // Regular expression to match full paths ending with .js, .mjs, or .ts
			return typeof fullPath === 'string' && regex.test(fullPath);
		}
		const msg = this.#sampleData;
		if (typeof this.#callback == "function") {
			await this.#handleWithWorkerMain(msg)
		} else if (typeof this.#callback == "string" && isValidFullPath(this.#callback)) {
			await this.#handleWithWorkerChild(msg)
		} else {
			throw new Error(`Callback at ${this.name} invalid`)
		}

		return this
	}

	/**
	 * Retry handle message
	 * 
	 * @param {MessageValueType} msg 
	 */
	async #retry(msg) {
		setTimeout(async () => {
			logFunc(`Retry Job ${this.name} - ${this.id} `, this.#options.log)
			await this.try(msg, "retry")
		}, this.#options.retryAfter)
	}

	/**
	 * 
	 * @param {MessageValueType} message 
	 * @returns 
	 */
	#formdata(message) {
		return {
			id: this.id,
			name: this.name,
			workerName: this.worker.name,
			type: "scheduleJob",
			options: this.#options,
			handleAt: new Date().getTime(),
			message: {
				id: crypto.randomUUID(),
				value: { ...message }
			},
			tried: this.#tried
		}
	}

	async #handleWithWorkerMain(msg) {
		try {
			await this.#withTimeout(this.#callback(this.#formdata(msg)))
			this.worker.downInstance(this.name, this.id, "scheduleJob")
			logFunc(`Handle Done: Schedule ${this.name} - ${this.id}`, this.#options.log);
		} catch (error) {
			if (this.#tried < this.#options.retry + 1) {
				await this.#retry(msg)
			} else {
				this.worker.downInstance(this.name, this.id, "scheduleJob")
			}
			logErrorFunc(`Handling Error: ${this.name} - ${this.id}, message: ${msg.value} : ${error.message}`, this.#options.log);

		}
	}

	async #handleWithWorkerChild(msg) {
		this.#mainWorker.postMessage({
			callbackPath: this.#callback,
			message: this.#formdata(msg),
			jobName: this.name,
			jobOptions: this.#options
		});

		const cleanup = () => {
			this.#mainWorker.off('message', messageHandler);
			this.#mainWorker.off('error', errorHandler);
			this.#mainWorker.off('exit', exitHandler);
			this.#mainWorker.terminate();
		};

		const messageHandler = async (message) => {
			if (message.status === 'success') {
				logFunc(`Handle Done: Schedule ${this.name} - ${this.id}`, this.#options.log);
				this.worker.downInstance(this.name, this.id, "scheduleJob")
				cleanup();
			} else {
				if (this.#tried < this.#options.retry + 1) {
					await this.#retry(msg)
				} else {
					this.worker.downInstance(this.name, this.id, "scheduleJob")
					cleanup();
				}
				logErrorFunc(`Handling Error: ${this.name} - ${this.id}, message: ${msg.value} : ${message.error}`, this.#options.log);
			}
		};

		const errorHandler = (error) => {
			errorFunc(`Worker error: ${error}`);
			cleanup();
		};

		const exitHandler = (code) => {
			if (code !== 0) {
				logFunc(`Worker stopped with exit code: ${code}`, this.#options.log);
			}
			cleanup();
		};

		this.#mainWorker.on('message', messageHandler);
		this.#mainWorker.on('error', errorHandler);
		this.#mainWorker.on('exit', exitHandler);

		return this
	}

	async #withTimeout(promise) {
		let timeout;
		const timeoutPromise = new Promise((_, reject) => {
			timeout = setTimeout(() => reject(errorFunc(`Job ${this.name} timeout exceeded`)), this.#options.timeout);
		});

		try {
			const result = await Promise.race([promise, timeoutPromise]);
			return result;
		} catch (error) {
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}
}

module.exports = ScheduleJob