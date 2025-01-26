<p align="center">
  <img width="250" src="https://github.com/knfs-library/bbq/blob/master/docs/images/logo.png?raw=true">
  <br>
	<a href="https://github.com/knfs-library/bbq/actions/workflows/unit-test.yml" alt="github">
	<img src="https://github.com/knfs-library/bbq/actions/workflows/unit-test.yml/badge.svg" alt="Github Actions" />
	</a>
</p>

# About **Baby Queue**

## BBQ - A Simple Job Queue System

**BBQ** is a lightweight and efficient job queuing system designed to integrate directly on local files of Node.js applications. With built-in support for job management, workers, and message handling, BBQ helps you streamline asynchronous task execution and improve the performance of your applications.

## Key Features

- **Job Queue Management**: Easily create and manage multiple job queues to handle asynchronous tasks efficiently.
- **Worker Support**: Utilize worker threads to process jobs concurrently, ensuring your application remains responsive and capable of handling high workloads.
- **Retry Mechanism**: Automatically retry failed jobs based on configurable settings, ensuring reliability in job processing.
- **Timeout Handling**: Set maximum execution times for jobs, allowing you to manage long-running tasks effectively.
- **Flexible Configuration**: Customize the behavior of your job queues with options for concurrency, logging, and job expiration.
- **Event-Driven Architecture**: Listen for events and process messages seamlessly, making it easy to integrate with other parts of your application.

## Why Choose BBQ?

Whether you're building a small application or a large-scale system, BBQ provides the tools you need to implement effective job processing strategies. Its simple API and robust features make it an ideal choice for developers looking to enhance their application's performance and reliability.


## Installation

Install BAMIMI Cache via **npm** or **yarn**:

```bash
npm i @knfs-tech/bbq
# OR
yarn add @knfs-tech/bbq
```

---

## Basic Usage

### Example

```javascript
const Dispatcher = require('bbq-cache');

const dispatcher = new Dispatcher({
    log: true,
});

async function handleJob(job) {
  console.log(job.message)
}

async function demo() {
  await dispatch.setup();

  const queue = await dispatcher.createQueue('queue-1');

  const worker = dispatch.createWorker("worker-1")
  worker.addJob("job-1", "queue-1", handleJob)

  await queue.addMessage('Hello, World!');
  await queue.addMessage({
    msg: 'Hello, World'
    nation: 'Vietnam'
  });
  await queue.addMessage(84);
}

demo();
```

---
## More
* [Dispatcher](https://github.com/knfs-library/bbq/blob/master/docs/DISPATCHER.md)
* [Queue](https://github.com/knfs-library/bbq/blob/master/docs/QUEUE.md)
* [Worker](https://github.com/knfs-library/bbq/blob/master/docs/WORKER.md)
* [Job](https://github.com/knfs-library/bbq/blob/master/docs/JOB.md)
* [Tips](https://github.com/knfs-library/bbq/blob/master/docs/TIP.md)
---

## Author
* [Kent Phung](https://github.com/khapu2906)
  
## Owner
* [Knfs.,jsc](https://github.com/knfs-library)

---
## Contributions

We welcome contributions! Please create a pull request or submit issues on GitHub.

---

## License

**BBQ** is open-source software licensed under the [MIT License](LICENSE).