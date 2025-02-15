const ScheduleJob = require("./../lib/cjs/scheduleJob");
const crypto = require("crypto");
const path = require("path");

jest.mock("crypto", () => ({
	randomUUID: jest.fn(() => "mocked-uuid"),
}));

jest.mock("worker_threads", () => ({
	Worker: jest.fn().mockImplementation(() => ({
		setMaxListeners: jest.fn(),
		postMessage: jest.fn(),
		on: jest.fn(),
		off: jest.fn(),
		terminate: jest.fn(),
	})),
}));

jest.mock("../lib/cjs/utils/log.js", () => ({
	log: jest.fn(),
	error: jest.fn(),
	logError: jest.fn(),
}));

describe("ScheduleJob", () => {
	let workerMock;
	let sampleData;
	let callbackMock;
	let optionsMock;

	beforeEach(() => {
		workerMock = {
			id: "worker-id",
			name: "test-worker",
			downInstance: jest.fn(),
		};

		sampleData = { value: "test-data" };

		callbackMock = jest.fn().mockResolvedValue("callback-success");

		optionsMock = {
			maxListeners: 10,
			log: true,
			retry: 3,
			retryAfter: 1000,
			timeout: 5000,
		};
	});

	test("constructor initializes correctly", () => {
		const job = new ScheduleJob("test-job", workerMock, sampleData, "0 * * * *", callbackMock, optionsMock);

		expect(job.id).toBe("mocked-uuid");
		expect(job.name).toBe("test-job");
		expect(job.worker).toEqual(workerMock);
		expect(job.schedulePattern).toBe("0 * * * *");
	});

	test("getMainWorker returns worker instance", () => {
		const job = new ScheduleJob("test-job", workerMock, sampleData, "0 * * * *", callbackMock, optionsMock);

		expect(job.getMainWorker()).toBeDefined();
	});

	test("try method calls callback when it's a function", async () => {
		const job = new ScheduleJob("test-job", workerMock, sampleData, "0 * * * *", callbackMock, optionsMock);

		await job.try();

		expect(callbackMock).toHaveBeenCalled();
	});

	test("try method throws error for invalid callback", async () => {
		const job = new ScheduleJob("test-job", workerMock, sampleData, "0 * * * *", 123, optionsMock);

		await expect(job.try()).rejects.toThrow("Callback at test-job invalid");
	});

	test("worker should be terminated after execution", async () => {
		const job = new ScheduleJob("test-job", workerMock, sampleData, "0 * * * *", callbackMock, optionsMock);

		await job.try();

		expect(workerMock.downInstance).toHaveBeenCalledWith("test-job", "mocked-uuid", "scheduleJob");
	});

	test("retry logic works when callback fails", async () => {
		callbackMock.mockRejectedValueOnce(new Error("Failed"));

		const job = new ScheduleJob("test-job", workerMock, sampleData, "0 * * * *", callbackMock, optionsMock);

		jest.useFakeTimers();
		await job.try();
		jest.advanceTimersByTime(1000);

		expect(callbackMock).toHaveBeenCalledTimes(2);
	});

	test("handles worker child process properly", async () => {
		const job = new ScheduleJob("test-job", workerMock, sampleData, "0 * * * *", path.resolve(__dirname, "dummy.js"), optionsMock);

		await job.try();

		expect(job.getMainWorker().postMessage).toHaveBeenCalled();
	});
});
