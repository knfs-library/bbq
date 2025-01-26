export default {
	log: false,
	retry: 0, // - The number of times to retry if the job fails.
	timeout: 60 * 1000, // - The maximum time (in milliseconds) for the job to complete before being canceled.
	retryAfter: 30 * 1000, // - The time (in milliseconds) to wait before retrying the job.
	maxListeners: 100, // - The maximum number of listeners for a job.
	concurrency: 20, // - The number of jobs that can run concurrently.
	workingMessageCount: 100 // - The current number of messages being processed.
};
