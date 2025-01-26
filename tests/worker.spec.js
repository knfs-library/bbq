const Worker = require('./../lib/cjs/worker');
const Job = require("./../lib/cjs/job");
const jobOptionDefault = require('./../lib/cjs/configs/job');
const workerDefault = require('./../lib/cjs/configs/worker');

jest.mock('./../lib/cjs/job');

describe('Worker Class', () => {
	let mockDispatcher;
	let worker;

	beforeEach(() => {
		mockDispatcher = {
			getQueue: jest.fn().mockReturnValue({ id: 'queue1', broadcast: jest.fn() }),
			getQueueById: jest.fn().mockReturnValue({ id: 'queue1', broadcast: jest.fn() }),
		};


		worker = new Worker('testWorker', workerDefault.options, mockDispatcher);

		jest.spyOn(global, 'setInterval').mockImplementation((callback, interval) => {
			callback();
			return 1;
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	test('should initialize with correct properties', () => {
		expect(worker.name).toBe('testWorker');
		expect(worker.id).toBeDefined();
	});

	test('should add a job correctly', () => {
		const jobName = 'testJob';
		const queueName = 'queue1';
		const callback = jest.fn();

		const job = worker.createJob(jobName, queueName, callback, jobOptionDefault);

		const jobs = worker.getJobs()
		expect(jobs).toHaveLength(1);
		expect(jobs[0].name).toBe(jobName);
		expect(jobs[0].queue.id).toBe('queue1');
	}, 5000);

	test('should not allow duplicate job names', () => {
		const jobName = 'testJob';
		const queueName = 'queue1';
		const callback = jest.fn();

		worker.createJob(jobName, queueName, callback, jobOptionDefault);

		expect(() => {
			worker.createJob(jobName, queueName, callback, jobOptionDefault);
		}).toThrow('Job Name Duplicate!');
	}, 5000);

	test('should run a job correctly', async () => {
		const jobName = 'testJob';
		const queueName = 'queue1';
		const callback = jest.fn();
		const message = { id: 'msg1', value: 'test', queueId: 'queue1' };

		worker.createJob(jobName, queueName, callback, jobOptionDefault);

		await worker.run({ id: 'queue1' }, message);

		const jobs = worker.getJobs()
		expect(jobs[0].workingMessage).toHaveLength(1);
		expect(jobs[0].workingMessage[0]).toEqual(message);
	}, 5000);

	test('should remove message from workingMessage on downMessage', async () => {
		const jobName = 'testJob';
		const queueName = 'queue1';
		const callback = jest.fn();
		const message = { id: 'msg1', value: 'test', queueId: 'queue1' };

		worker.createJob(jobName, queueName, callback, jobOptionDefault);
		await worker.run({ id: 'queue1' }, message);

		await worker.downMessage(jobName, message);
		const jobs = worker.getJobs()

		expect(jobs[0].workingMessage).toHaveLength(0);
	}, 5000);
});