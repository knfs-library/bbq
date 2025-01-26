const Queue = require('./../lib/cjs/queue');
const fs = require('fs-extra');
const path = require('path');

const TEST_DIR = path.join(__dirname, 'test-queue');

const mockDispatcher = {
	listen: jest.fn(),
};

beforeAll(async () => {
	await fs.ensureDir(TEST_DIR);
});

afterAll(async () => {
	await fs.remove(TEST_DIR);
});

describe('Queue Class', () => {
	let queue;

	beforeEach(() => {
		queue = new Queue('testQueue', TEST_DIR, mockDispatcher);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	test('should initialize with correct properties', () => {
		expect(queue.name).toBe('testQueue');
		expect(queue.path).toBe(TEST_DIR);
		expect(queue.id).toBeDefined();
		expect(queue.getPipeline()).toEqual([]);
		expect(queue.getFails()).toEqual([]);
	});

	test('should add a message correctly', async () => {
		const message = {
			msg: "Hello World"
		};
		await queue.addMessage(message);

		const pipeline = queue.getPipeline();
		expect(pipeline).toHaveLength(1);
		expect(pipeline[0]).toHaveProperty('id');
		expect(pipeline[0].type).toBe('object');
		expect(pipeline[0].size).toBe(Buffer.byteLength(JSON.stringify(message), 'utf8'));
		expect(pipeline[0].failedCount).toBe(0);
		expect(pipeline[0].failedAt).toBe(null);
		expect(pipeline[0].path).toMatch(/msgs\/[a-f0-9]{32}\.knmbbq/);
	});

	test('should fail if message size exceeds limit', async () => {
		queue.getOption().size = 5;
		const message = 'Hello, World!';

		try {
			await queue.addMessage(message);
		} catch (error) {
			expect(error.message).toMatch(/Message size is over at queue testQueue/);
		}

		expect(queue.getPipeline()).toHaveLength(0);
	});

	test('should broadcast a message', async () => {
		const message = 'Hello, World!';
		await queue.addMessage(message);

		await queue.broadcast(queue.getPipeline()[0]);

		expect(mockDispatcher.listen).toHaveBeenCalledWith(queue.id, expect.objectContaining({
			id: expect.any(String),
			size: expect.any(Number),
			path: expect.any(String),
			path: expect.any(String),
			value: expect.any(String),
		}));
	});

	test('should handle failed messages', async () => {
		const message = 'Hello, World!';
		await queue.addMessage(message);
		const messageId = queue.getPipeline()[0].id;

		await queue.fail(messageId);
		const failedMessages = queue.getFails();

		expect(failedMessages).toHaveLength(1);
		expect(failedMessages[0].id).toBe(messageId);
	});

	test('should delete messages after timeout', async () => {
		const message = 'Hello, World!';
		await queue.addMessage(message);
		const messageId = queue.getPipeline()[0].id;

		await queue.done(messageId);

		await new Promise(resolve => setTimeout(resolve, 1100));

		expect(queue.getPipeline()).toHaveLength(0);
	});

	test('should re-broadcast messages', async () => {
		const message = 'Hello, World!';
		await queue.addMessage(message);

		await queue.reBroadCast();

		expect(mockDispatcher.listen).toHaveBeenCalled();
	});
});