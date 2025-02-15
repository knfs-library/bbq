const { parseCronExpression, isTimeToRun, convertToCronExpression } = require("../../lib/cjs/utils/cron-time");

describe("parseCronExpression", () => {
	test("parses valid cron expressions correctly", () => {
		expect(parseCronExpression("0 12 * * *")).toEqual({
			minute: "0",
			hour: "12",
			dayOfMonth: "*",
			month: "*",
			dayOfWeek: "*",
		});

		expect(parseCronExpression("* * * * *")).toEqual({
			minute: "*",
			hour: "*",
			dayOfMonth: "*",
			month: "*",
			dayOfWeek: "*",
		});

		expect(parseCronExpression("30 14 5 6 2")).toEqual({
			minute: "30",
			hour: "14",
			dayOfMonth: "5",
			month: "6",
			dayOfWeek: "2",
		});
	});

	test("throws an error for invalid cron expressions", () => {
		expect(() => parseCronExpression("0 12 *")).toThrow("Invalid cron expression");
		expect(() => parseCronExpression("60 12 * * *")).toThrow("Minute out of range (0-59)");
		expect(() => parseCronExpression("0 24 * * *")).toThrow("Hour out of range (0-23)");
		expect(() => parseCronExpression("0 12 32 * *")).toThrow("Day of Month out of range (1-31)");
		expect(() => parseCronExpression("0 12 * 13 *")).toThrow("Month out of range (1-12)");
		expect(() => parseCronExpression("0 12 * * 8")).toThrow("Day of Week out of range (0-7)");
	});
});

describe("convertToCronExpression", () => {
	test("converts predefined schedules to cron expressions", () => {
		expect(convertToCronExpression("daily")).toEqual(parseCronExpression("0 0 * * *"));
		expect(convertToCronExpression("weekly")).toEqual(parseCronExpression("0 0 * * 1"));
		expect(convertToCronExpression("monthly")).toEqual(parseCronExpression("0 0 1 * *"));
		expect(convertToCronExpression("yearly")).toEqual(parseCronExpression("0 0 1 1 *"));
		expect(convertToCronExpression("hourly")).toEqual(parseCronExpression("0 * * * *"));
		expect(convertToCronExpression("minutely")).toEqual(parseCronExpression("* * * * *"));
		expect(convertToCronExpression("sunday")).toEqual(parseCronExpression("0 0 * * 0"));
	});

	test("returns parsed expression for custom cron schedules", () => {
		expect(convertToCronExpression("5 10 * * *")).toEqual(parseCronExpression("5 10 * * *"));
	});

	test("throws error for invalid cron expressions", () => {
		expect(() => convertToCronExpression("invalid cron")).toThrow("Invalid cron expression");
	});
});

describe("isTimeToRun", () => {
	beforeAll(() => {
		jest.useFakeTimers().setSystemTime(new Date("2025-01-31T12:00:00Z")); // Mock thời gian hiện tại
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	test("returns true when current time matches cron schedule", () => {
		expect(isTimeToRun(parseCronExpression("0 12 * * *"), "UTC")).toBe(true);
		expect(isTimeToRun(parseCronExpression("* * * * *"), "UTC")).toBe(true);
		expect(isTimeToRun(parseCronExpression("0 12 31 1 *"), "UTC")).toBe(true);
	});

	test("returns false when current time does not match cron schedule", () => {
		expect(isTimeToRun(parseCronExpression("0 13 * * *"), "UTC")).toBe(false);
		expect(isTimeToRun(parseCronExpression("30 12 * * *"), "UTC")).toBe(false);
		expect(isTimeToRun(parseCronExpression("0 12 30 1 *"), "UTC")).toBe(false);
	});

	test("handles day of week correctly", () => {
		expect(isTimeToRun(parseCronExpression("0 12 * * 5"), "UTC")).toBe(false); // Thứ Sáu (5), nhưng ngày 31/01/2025 là Thứ Sáu
		expect(isTimeToRun(parseCronExpression("0 12 * * 4"), "UTC")).toBe(false); // Thứ Năm (4), nhưng hôm nay là Thứ Sáu
	});
});
