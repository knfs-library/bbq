const Job = require("./job")
const crypto = require("crypto");
const jobOptionDefault = require("./configs/job")
const workerDefault = require("./configs/worker")
const { log: logFunc, error: errorFunc } = require("./utils/log")

/**
 * @typedef  JobOption
 * @property {number} retry - The number of times to retry if the job fails.
 * @property {number} timeout - The maximum time (in milliseconds) for the job to complete before being canceled.
 * @property {number} retryAfter - The time (in milliseconds) to wait before retrying the job.
 * @property {number} maxListeners - The maximum number of listeners for a job.
 * @property {number} concurrency - The number of jobs that can run concurrently.
 * @property {number} workingMessageCount - The current number of messages being processed.
 * @property {bool} log - Allow Log yes or no
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
 *  @typedef {Object} QueueType
 * @property {string} id
 * @property {string} name
 * @property {function(message: string)} fail
 * @property {function(messageId: string)} done
 * @property {function(message: MessageValueType)} broadcast
 * @property {function(): OptionQueueType} getOption
 */

/**
 * @typedef JobType
 * @property {string} name
 * @property {QueueType} queue
 * @property {Worker} worker
 * @property {string | function} callback
 * @property {JobOption} options
 */


class Worker {
	/**
	 * List job structure
	 * 
	 * @type {Array<JobType>}
	 */
	#jobs = []

	/**
	 * @type {Map}
	 */
	#jobIntervale

	/**
	 * 
	 * @type {workerDefault.options}
	 */
	#options

	/**
	 * information about which queue workers are listening
	 * 
	 * @type {Map}
	 */
	#observerQueue

	/**
	 * Management dispatcher information
	 * 
	 * @param {Object} dispatcher 
	 */
	#dispatcher

	constructor(name, options = workerDefault.options, dispatcher) {
		this.id = crypto.randomUUID();
		this.name = name

		const defaultOptions = workerDefault.options
		this.#options = { ...defaultOptions, ...options }

		this.#dispatcher = dispatcher

		this.#observerQueue = new Map()

		this.#jobIntervale = new Map();
	}

	/**
	 * Get jobs
	 * 
	 * @returns 
	 */
	getJobs() {
		return this.#jobs;
	}

	/**
	 * Get jobs
	 * 
	 * @returns 
	 */
	getJob(name) {
		return this.#jobs.find(job => job.name === name);
	}

	/**
	 * check whether Queue is observed by Worker or not
	 * 
	 * @param {String} queueName
	 * 
	 * @return {Bool}
	 */
	existObserverQueue(queueName) {
		if (this.#observerQueue.has(queueName)) {
			return this.#observerQueue.get(queueName);
		}

		return false;
	}

	/**
	 * Add Job to worker
	 * 
	 * @param {String} name
	 * @param {String} queueName
	 * @param {function| string} callback 
	 * @param {JobOption} options 
	 */
	createJob(name, queueName, callback, options = jobOptionDefault) {
		const iExistJob = this.#jobs.findIndex(nJob => nJob.name === name)

		if (-1 < iExistJob) {
			errorFunc("Job Name Duplicate!")
		}

		const queue = this.#dispatcher.getQueue(queueName)
		const jobStructure = {
			name,
			queue,
			options: {
				...options,
				log: options.log ? options.log : this.#options.log,
			},
			callback: callback,
			instances: [],
			workingMessage: [],
		}
		
		this.#jobs.push(jobStructure);
		this.#jobIntervale.set(name, this.#intervalRun(name))

		if (!this.#observerQueue.has(queue.id)) {
			this.#observerQueue.set(queue.id, true)
		}

		return jobStructure
	}

	/**
	 * Run Worker
	 * 
	 * @param {QueueType} queue 
	 * @param {MessageValueType} message 
	 */
	async run(queue, message) {
		//Jobs that are on the queue and have a workingMessage number that has not reached the limit are considered valid
		const validJobs = this.#jobs.filter(job => job.queue.id === queue.id && job.workingMessage.length < job.options.workingMessageCount)
		
		//If no job is found, proceed with rebroadcast after the configured time period
		if (!validJobs.length) {
			logFunc(`Valid Job Not Found at ${this.name}`, this.#options.log);
			this.#observerQueue.set(queue.id, false)
			setTimeout(async () => {
				await queue.broadcast(message)
			}, queue.getOption().rebroadcastTime)

			return;
		}

		const chooseJob = validJobs.reduce((readyJob, currentJob) => {
			return (readyJob.workingMessage.length < currentJob.workingMessage.length) ? readyJob : currentJob
		})

		const job = this.#jobs.find(job => job.name === chooseJob.name)
		job.workingMessage.push(message)
	}

	/**
	 * Delete the message when it has been retrieved for processing
	 * 
	 * @param {String} jobName 
	 * @param {MessageValueType} message 
	 */
	async downMessage(jobName, message) {
		const validJob = this.#jobs.find(job => job.name === jobName)
		validJob.workingMessage = validJob.workingMessage.filter(wMsg => wMsg.id != message.id)
		this.#observerQueue.set(message.queueId, true)
	}


	/**
	 * delete the job instance when it has completed its task
	 * 
	 * @param {String} jobName 
	 * @param {String} jobId 
	 */
	async downInstance(jobName, jobId) {
		const validJob = this.#jobs.find(job => job.name === jobName)
		let instance = validJob.instances.find(ins => ins.id == jobId)
		validJob.instances = validJob.instances.filter(ins => ins.id !== jobId)
		instance = null;
	}

	/**
	 * 
	 * Add interval run for job
	 * 
	 * @param {String} jobName
	 */
	async #intervalRun(jobName) {
		const job = this.#jobs.find(job => job.name === jobName)
		return setInterval(async () => {
			logFunc(`Check job ${jobName}`, this.#options.log)
			for (const message of job.workingMessage) {
				let instance
				if (0 == job.instances.length) {
					instance = new Job(
						job.name,
						this,
						job.queue,
						job.callback,
						job.options
					)

					job.instances.push(instance)
					await instance.try(message)
				} else if (job.instances.length < job.options.concurrency) {
					instance = new Job(
						job.name,
						this,
						job.queue,
						job.callback,
						job.options
					)
					job.instances.push(instance)
					await instance.try(message)
				}
			}
		}, this.#options.intervalRunJob)
	}
}

module.exports = Worker