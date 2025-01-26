# Worker

## Overview
The `Worker` processes messages from queues. It manages the execution of jobs and handles message failures.

## API Reference

### Methods

#### createJob(name, queueName, callback, options)
Add / Create job to worker
| Parameter         | Type | Default | Description             |
| ----------------- | ---- | ------- | ----------------------- |
| `name` | string |    | Name of Job is Unique |
| `queueName` | string |    | The name of the Queue and job will listen for processing. |
| `callback` | function(job) / path to module function(job)  |    | Function handles that job(if the type is function it will run on the main thread, if the type is path it will run on the worker thread). |
| `options.log`    | Boolean | false | Enable or disable logging.                                         |
| `options.retry`    | number | 0 | The number of times to retry if the job fails.                                         |
| `options.timeout`    | number | 60000 (ms) | The maximum time (in milliseconds) for the job to complete before being canceled. |
| `options.retryAfter`    | number | 30000 (ms) | The time (in milliseconds) to wait before retrying the job. |
| `options.maxListeners`    | number | 100 | The maximum number of system worker's listeners for a job. |
| `options.concurrency`    | number | 20 |The number of jobs that can run concurrently. |
| `options.workingMessageCount`    | number | 100 |The current number of messages being processed. |

*Ex:*
```javascript
// use function
async function handleJob(job) {
	console.log(job.message)
}

worker.createJob("job-1", "queue-1", handleJob, options = {
  log: false,
  retry: 1,
  timeout: 5 * 1000, //5s
  retryAfter: 5 * 1000,
  maxListeners: 300,
  concurrency: 500,
  workingMessageCount: 500,
})

//use path
const path = require("path")

worker.createJob("job-2", "queue-2", path.resolve(__dirname, "/path/to/module/job.js"), options = {
  log: false,
  retry: 1,
  timeout: 5 * 1000, //5s
  retryAfter: 5 * 1000,
  maxListeners: 300,
  concurrency: 500,
  workingMessageCount: 500,
})
```

#### getJob(name)
Retrieves an existing job by name.
```javascript
const job = worker.getJob("job-1")
```

#### getJobs()
Retrieves all job.
```javascript
const jobs = worker.getJobs()

```

---
## Other
* [Dispatcher](https://github.com/knfs-library/bbq/blob/master/docs/DISPATCHER.md)
* [Queue](https://github.com/knfs-library/bbq/blob/master/docs/QUEUE.md)
* [Job](https://github.com/knfs-library/bbq/blob/master/docs/JOB.md)
* [Tips](https://github.com/knfs-library/bbq/blob/master/docs/TIP.md)