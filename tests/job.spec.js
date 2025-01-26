const { Worker } = require('worker_threads');
const Job = require("./../lib/cjs/job");

jest.mock('worker_threads');
jest.spyOn(global, 'setTimeout');

describe('Job Class', () => {
	let mockWorker;
	let mockQueue;
	let mockCallback;
	let job;

	beforeEach(() => {
		mockWorker = {
			name: 'mockWorker',
			downMessage: jest.fn(),
			downInstance: jest.fn(),
		};

		mockQueue = {
			name: 'mockQueue',
			done: jest.fn(),
			fail: jest.fn(),
		};

		mockCallback = 'mock/mockCallback.js';

		Worker.mockImplementation(() => {
			return {
				postMessage: jest.fn(),
				on: jest.fn(),
				off: jest.fn(),
				terminate: jest.fn(),
				setMaxListeners: jest.fn(),
			};
		});

		jest.spyOn(global, 'setTimeout');

		job = new Job('testJob', mockWorker, mockQueue, mockCallback);
	});

	afterEach(() => {
		jest.clearAllMocks();
		jest.clearAllTimers();
		global.setTimeout.mockRestore();
		job = null
	});

	test('should create a Job instance with a unique ID', () => {
		expect(job.id).toBeDefined();
		expect(typeof job.id).toBe('string');
		expect(job.id).toHaveLength(36); // UUID length
	});

	test('should initialize with correct properties', () => {
		expect(job.name).toBe('testJob');
		expect(job.worker).toBe(mockWorker);
		expect(job.queue).toBe(mockQueue);
	});

	test('should call postMessage with correct parameters in try method', async () => {
		const message = { id: 'msg1', size: 100, path: '/path/to/message', createdAt: Date.now(), value: 'test' };

		await job.try(message);

		expect(mockWorker.downMessage).toHaveBeenCalledWith(job.name, message);

		const mainWorker = job.getMainWorker()
		expect(mainWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
			callbackPath: mockCallback,
			message: expect.any(Object),
			jobName: job.name,
			jobOptions: expect.any(Object),
		}));
	});

	test('should handle success message correctly', async () => {
		const message = { id: 'msg1', size: 100, path: '/path/to/message', createdAt: Date.now(), value: 'test' };

		const mainWorker = job.getMainWorker()
		mainWorker.on.mockImplementation((event, handler) => {
			if (event === 'message') {
				handler({ status: 'success' });
			}
		});

		await job.try(message);

		expect(mockQueue.done).toHaveBeenCalledWith(message.id);
		expect(mockWorker.downInstance).toHaveBeenCalledWith(job.name, job.id);
	});

	test('should handle error message correctly and retry', async () => {
		const message = { id: 'msg1', size: 100, path: '/path/to/message', createdAt: Date.now(), value: 'test' };

		const mainWorker = job.getMainWorker()
		mainWorker.on.mockImplementation((event, handler) => {
			if (event === 'message') {
				handler({ status: 'error', error: 'Some error' });
			}
		});
		await job.try(message);

		expect(mockQueue.fail).toHaveBeenCalledWith(message.id);
		expect(mockWorker.downInstance).toHaveBeenCalledWith(job.name, job.id);
	});
});