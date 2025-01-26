const Dispatcher = require('./../lib/cjs/');
const Queue = require('./../lib/cjs/queue');
const fs = require('fs-extra');
const path = require('path');

const TEST_DIR = path.join(__dirname, 'test-dispatcher');

const mockQueueOption = {
	size: 1024,
	expire: 60,
	limit: 10,
};

const mockDispatcherOption = {
	path: TEST_DIR,
	log: false,
	queueOption: mockQueueOption,
};

beforeAll(async () => {
	await fs.ensureDir(TEST_DIR);
});

afterAll(async () => {
	await fs.remove(TEST_DIR); 
});

describe('Dispatcher Class', () => {
	let dispatcher;

	beforeEach(async () => {
		dispatcher = new Dispatcher(mockDispatcherOption);
		await dispatcher.setup();
	});

	afterEach(async () => {
		jest.clearAllMocks();
	});

	test('should initialize with correct properties', async () => {
		expect(dispatcher.getQueues()).toEqual(new Map());
		expect(dispatcher.getWorkers().length).toEqual(0)
	});

	test('should create a queue correctly', async () => {
		const queueName = 'testQueue';
		const queue = await dispatcher.createQueue(queueName);

		expect(queue.name).toBe(queueName);
		expect(dispatcher.getQueue(queueName)).toBe(queue);
	});

	test('should get an existing queue', async () => {
		const queueName = 'testQueue1';
		await dispatcher.createQueue(queueName);

		const queue = dispatcher.getQueue(queueName);
		expect(queue.name).toBe(queueName);
	});

	test('should throw an error if getting a non-existing queue', () => {
		expect(() => {
			dispatcher.getQueue('nonExistingQueue');
		}).toThrow('Queue nonExistingQueue not exist');
	});

	test('should delete an existing queue', async () => {
		const queueName = 'testQueueDelete';
		await dispatcher.createQueue(queueName);

		expect(dispatcher.getQueue(queueName)).toBeDefined();

		await dispatcher.deleteQueue(queueName);

		expect(() => {
			dispatcher.getQueue(queueName);
		}).toThrow(`Queue ${queueName} not exist`);
	});

	test('should create a worker correctly', () => {
		const workerName = 'testWorker';
		const worker = dispatcher.createWorker(workerName);

		expect(worker.name).toBe(workerName);
		expect(dispatcher.getWorker(workerName)).toBe(worker);
	});

	test('should not allow duplicate worker names', () => {
		const workerName = 'testWorker';
		dispatcher.createWorker(workerName);

		expect(() => {
			dispatcher.createWorker(workerName);
		}).toThrow('Worker Name Duplicate!');
	});

	test('should listen to events and process messages', async () => {
		const queueName = 'testQueue2';
		const queue = await dispatcher.createQueue(queueName);
		const message = { id: 'msg1', value: 'Hello, World!' };
		dispatcher.listen(queue.id, message);
	});
});