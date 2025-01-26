import path from 'path';

export const pathResolved = path.resolve(process.cwd(), 'bbq');
export const queueConfig = {
	size: 2048,
	expire: 0,
	secretKey: '',
	limit: 0,
	updateMetaTime: 3000
};
export const log = false;
