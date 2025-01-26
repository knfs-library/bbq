import crypto from 'crypto';
import jobOptionDefault from './configs/job.mjs';
import { log as logFunc, error as errorFunc, logError as logErrorFunc } from './utils/log.mjs';
import { Worker as SysWorker } from 'worker_threads';
import path from 'path';

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
 * @typedef {Object} QueueType
 * @property {string} id
 * @property {string} name
 * @property {function(message: string)} fail
 * @property {function(messageId: string)} done
 * @property {function(message: MessageValueType)} broadcast
 * @property {function(): OptionQueueType} getOption
 */

/**
 *  @typedef {Object} WorkerType
 * @property {string} id
 * @property {string} name
 * @property {function(jobName:string, message: MessageValueType)} downMessage
 * @property {function(jobName: string, jobId: string)} downInstance
 */
class Job {
	/**
	 * @type {SysWorker}
	 */
	#mainWorker;

	/**
	 * @type {jobOptionDefault}
	 */
	#options;

	/**
	 * @type {function|string}
	 */
	#callback;

	/**
	 * @type {number}
	 */
	#tried = 0;

	/**
	 * @constructor
	 * @param {string} name 
	 * @param {WorkerType} worker 
	 * @param {QueueType} queue 
	 * @param {string | function} callback 
	 * @param {jobOptionDefault} options 
	 */
	constructor(
		name,
		worker,
		queue,
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
		 * @type {QueueType} 
		 */
		this.queue = queue;
		this.#callback = callback;
		this.#options = { ...jobOptionDefault, ...options };

		this.#mainWorker = new SysWorker(path.resolve(__dirname, 'workers/run-job.worker.mjs'), { captureRejections: true });
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
		return this.#mainWorker;
	}

	/**
	 * Try handle message
	 * 
	 * @param {MessageValueType} msg - message to handle 
	 * @param {string} type - is try or retry
	 * @returns 
	 */
	async try(msg, type = "try") {
		if (!msg) {
			return;
		}
		logFunc(`Run Job at ${this.name} - ${this.id}, state: ${type}`, this.#options.log);

		this.#tried += 1;
		this.worker.downMessage(this.name, msg);

		function isValidFullPath(fullPath) {
			const regex = /\/.*\.(js|mjs|ts)$/; // Regular expression to match full paths ending with .js, .mjs, or .ts
			return typeof fullPath === 'string' && regex.test(fullPath);
		}

		if (typeof this.#callback == "function") {
			await this.#handleWithWorkerMain(msg);
		} else if (typeof this.#callback == "string" && isValidFullPath(this.#callback)) {
			await this.#handleWithWorkerChild(msg);
		} else {
			throw new Error(`Callback at ${this.name} invalid`);
		}

		return this;
	}

	/**
	 * Retry handle message
	 * 
	 * @param {MessageValueType} msg 
	 */
	async #retry(msg) {
		setTimeout(async () => {
			logFunc(`Retry Job ${this.name} - ${this.id}`, this.#options.log);
			await this.try(msg, "retry");
		}, this.#options.retryAfter);
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
			queueName: this.queue.name,
			options: this.#options,
			handleAt: new Date().getTime(),
			message: { ...message },
			tried: this.#tried,
		};
	}

	async #handleWithWorkerMain(msg) {
		try {
			await this.#withTimeout(this.#callback(this.#formdata(msg)));
			this.worker.downInstance(this.name, this.id);
			await this.queue.done(msg.id);
			logFunc(`Handle Done: ${this.name} - ${this.id}, message: ${msg.id}`, this.#options.log);
		} catch (error) {
			msg = { ...msg, ...await this.queue.fail(msg.id) };
			if (this.#tried < this.#options.retry + 1) {
				await this.#retry(msg);
			} else {
				this.worker.downInstance(this.name, this.id);
			}
			logErrorFunc(`Handling Error: ${this.name} - ${this.id}, message: ${msg.id} : ${error.message}`, this.#options.log);
		}
	}

	async #handleWithWorkerChild(msg) {
		this.#mainWorker.postMessage({
			callbackPath: this.#callback,
			message: this.#formdata(msg),
			jobName: this.name,
			jobOptions: this.#options,
		});

		const cleanup = () => {
			this.#mainWorker.off('message', messageHandler);
			this.#mainWorker.off('error', errorHandler);
			this.#mainWorker.off('exit', exitHandler);
			this.#mainWorker.terminate();
		};

		const messageHandler = async (message) => {
			if (message.status === 'success') {
				logFunc(`Handle Done: ${this.name} - ${this.id}, message: ${msg.id}`, this.#options.log);
				this.worker.downInstance(this.name, this.id);
				await this.queue.done(msg.id);
				cleanup();
			} else {
				msg = { ...msg, ...await this.queue.fail(msg.id) };
				if (this.#tried < this.#options.retry + 1) {
					await this.#retry(msg);
				} else {
					this.worker.downInstance(this.name, this.id);
					cleanup();
				}
				logErrorFunc(`Handling Error: ${this.name} - ${this.id}, message: ${msg.id} : ${message.error}`, this.#options.log);
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

		return this;
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

export default Job;
