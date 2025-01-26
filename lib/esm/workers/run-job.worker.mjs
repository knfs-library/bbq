import { parentPort } from 'worker_threads';
import { error as errorFunc } from "../utils/log.mjs";
import path from "path";

async function withTimeout(promise, jobName, ms) {
	let timeout;
	const timeoutPromise = new Promise((_, reject) => {
		timeout = setTimeout(() => reject(errorFunc(`Job ${jobName} timeout exceeded`)), ms);
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

parentPort.on('message', async ({ callbackPath, message, jobName, jobOptions }) => {
	try {
		const cb = await import(path.resolve(process.cwd(), callbackPath));
		await withTimeout(cb.default(message), jobName, jobOptions.timeout);
		parentPort.postMessage({ status: 'success' });
	} catch (error) {
		parentPort.postMessage({ status: 'error', error: error.message });
	}
});
