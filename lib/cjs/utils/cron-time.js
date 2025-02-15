/**
 * 
 * Cron Expression Format:
 *   * * * * *
 *   - - - - -
 *   | | | | |
 *   | | | | +-- Day of the week (0 - 6) (Sunday = 0, 7 optional for Sunday)
 *   | | | +---- Month (1 - 12)
 *   | | +------ Day of the month (1 - 31)
 *   | +-------- Hour (0 - 23)
 *   +---------- Minute (0 - 59)
 * 
 */

/**
 * 
 * @param {string} timezone 
 * @returns {Date}
 */
function getDateWithTimezone(timezone) {
	const now = new Date();
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		hour12: false,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});

	const parts = formatter.formatToParts(now);

	const dateComponents = {};
	parts.forEach(({ type, value }) => {
		dateComponents[type] = value;
	});

	return new Date(
		`${dateComponents.year}-${dateComponents.month}-${dateComponents.day}T${dateComponents.hour}:${dateComponents.minute}:${dateComponents.second}Z`
	);
}

/**
 * 
 * @param {String} expression 
 * @returns
 */
function parseCronExpression(expression) {
	const parts = expression.split(' ');
	if (parts.length !== 5) {
		throw new Error(`Invalid cron expression: "${expression}". Expected 5 parts but got ${parts.length}.`);
	}

	// Helper function to validate each part
	const validatePart = (part, type) => {
		// const cronRegex = /^(\*|\d+([,-\/]\d+)*|\d+)$/;
		// if (!cronRegex.test(part)) {
		// 	throw new Error(`Invalid ${type} value: "${part}". Must be "*", a valid number, or a valid cron range.`);
		// }

		const values = part.split(',').map(v => v.trim());

		values.forEach(value => {
			if (value === '*') return;

			if (value.includes('-')) {
				const [start, end] = value.split('-').map(v => parseInt(v, 10));
				if (isNaN(start) || isNaN(end) || start > end) {
					throw new Error(`Invalid ${type} range: "${value}".`);
				}
				value = start;
			}

			if (value.includes('/')) {
				const [base, step] = value.split('/').map(v => parseInt(v, 10));
				if (isNaN(step) || step <= 0) {
					throw new Error(`Invalid ${type} step value: "${value}". Step must be a positive number.`);
				}
				value = base === '*' ? 0 : base; 
			}

			if (!isNaN(value)) {
				switch (type) {
					case 'minute':
						if (value < 0 || value > 59) throw new Error(`Minute out of range (0-59): "${value}"`);
						break;
					case 'hour':
						if (value < 0 || value > 23) throw new Error(`Hour out of range (0-23): "${value}"`);
						break;
					case 'dayOfMonth':
						if (value < 1 || value > 31) throw new Error(`Day of Month out of range (1-31): "${value}"`);
						break;
					case 'month':
						if (value < 1 || value > 12) throw new Error(`Month out of range (1-12): "${value}"`);
						break;
					case 'dayOfWeek':
						if (value < 0 || value > 7) throw new Error(`Day of Week out of range (0-7): "${value}"`);
						break;
					default:
						throw new Error(`Unknown type "${type}"`);
				}
			}
		});
	};

	validatePart(parts[0], 'minute');
	validatePart(parts[1], 'hour');
	validatePart(parts[2], 'dayOfMonth');
	validatePart(parts[3], 'month');
	validatePart(parts[4], 'dayOfWeek');


	// Return parsed object
	return {
		minute: parts[0],
		hour: parts[1],
		dayOfMonth: parts[2],
		month: parts[3],
		dayOfWeek: parts[4],
	};
}


/**
 * 
 * @param {string} cronSchedule 
 * @param {string} timezone 
 * @returns 
 */
function isTimeToRun(cronSchedule, timezone = 'UTC') {
	const now = getDateWithTimezone(timezone);

	const minuteMatch = cronSchedule.minute === '*' || cronSchedule.minute === now.getUTCMinutes().toString();
	const hourMatch = cronSchedule.hour === '*' || cronSchedule.hour === now.getUTCHours().toString();
	const dayOfMonthMatch = cronSchedule.dayOfMonth === '*' || cronSchedule.dayOfMonth === now.getUTCDate().toString();
	const monthMatch = cronSchedule.month === '*' || cronSchedule.month === (now.getUTCMonth() + 1).toString();
	const dayOfWeekMatch =
		cronSchedule.dayOfWeek === '*' ||
		cronSchedule.dayOfWeek === now.getUTCDay().toString() ||
		(cronSchedule.dayOfWeek === '7' && now.getUTCDay() === 0); // 7 as Sunday

	return minuteMatch && hourMatch && dayOfMonthMatch && monthMatch && dayOfWeekMatch;
}

/**
 * 
 * @param {string} form 
 * @returns 
 */
function convertToCronExpression(form) {
	switch (form) {
		case 'daily':
			return parseCronExpression('0 0 * * *');
		case 'weekly':
			return parseCronExpression('0 0 * * 1');
		case 'monthly':
			return parseCronExpression('0 0 1 * *');
		case 'yearly':
			return parseCronExpression('0 0 1 1 *');
		case 'hourly':
			return parseCronExpression('0 * * * *');
		case 'minutely':
			return parseCronExpression('* * * * *');
		case 'monday':
			return parseCronExpression('0 0 * * 1');
		case 'tuesday':
			return parseCronExpression('0 0 * * 2');
		case 'wednesday':
			return parseCronExpression('0 0 * * 3');
		case 'thursday':
			return parseCronExpression('0 0 * * 4');
		case 'friday':
			return parseCronExpression('0 0 * * 5');
		case 'saturday':
			return parseCronExpression('0 0 * * 6');
		case 'sunday':
			return parseCronExpression('0 0 * * 0');
		default:
			// if (!/^([\d*\/,-]+)\s+([\d*\/,-]+)\s+([\d*\/,-]+)\s+([\d*\/,-]+)\s+([\d*\/,-]+)$/.test(form)) {
			// 	throw new Error(`Invalid cron format: "${form}"`);
			// }
			return parseCronExpression(form);
	}
}


module.exports = {
	parseCronExpression,
	isTimeToRun,
	convertToCronExpression
}