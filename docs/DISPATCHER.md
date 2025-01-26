# Dispatcher

## Overview
The `Dispatcher` manages queues and workers, facilitating the processing of messages. It allows for the creation of queues, workers, and handles the broadcasting of messages.

## API Reference

### **Constructor**
#### `new Dispatcher(config)`

Creates a new instance of BBQ.

| Parameter             | Type    | Default              | Description                                                        | Support Version |
| --------------------- | ------- | -------------------- | ------------------------------------------------------------------ | --------------- |
| `config.path`         | String  | `projectPath + /bbq` | Directory to store queue files.                                    | >= 1.0.2        |
| `config.log`          | Boolean | `false`              | Enable or disable logging.                                         | >= 1.0.2        |
| `config.queue`        | Object  |                      | An object containing queue-specific configurations                 | >= 1.0.2        |
| `config.queue.size`   | Number  | 2048                 | The maximum size of messages in bytes.                             | >= 1.0.2        |
| `config.queue.expire` | Number  | 0                    | The expiration time for messages in seconds (0 is not allow).      | >= 1.0.2        |
| `config.queue.limit`  | Number  | 0                    | The maximum number of items allowed in the queue (0 is not allow). | >= 1.0.2        |
| `config.queue.updateMetaTime`  | Number  | 3000                    | TThe queue's metadata file will not be updated immediately when there is a change in data but needs to be changed after a precautionary period to avoid the case of too many overlapping updates causing errors(min is 1000). | >= 1.0.2        |
| `config.queue.secretKey`  | String  | ""                    | Key to encrypt data in the queue (default is "", not encrypted). | >= 1.0.2        |

*Ex:*
```javascript
const Dispatcher = require("@knfs-tech/bbq");

const dispatcher = new Dispatcher({
  path: "./queue-storage",
  log: true,
  queueOption: {
    size: 4096,
    limit: 1000,
    expire: 60 * 1000,
    updateMetaTime: 5000,
    secretKey: "secretKey"
  },
})
```

### Methods

#### **`setup()`**
Initialize configuration files
*Ex:*
```javascript
dispatcher = await dispatcher.setup();
```

### `createQueue(name, options)`
Creates a new queue.

| Parameter        | Type    | Description                                                        |
| ---------------- | ------- | ------------------------------------------------------------------ |
| `name`           | String  | Name of Queue.                                                     |
| `options.size`   | Number  | The maximum size of messages in bytes.                             |
| `options.expire` | Number  | The expiration time for messages in seconds (0 is not allow).      |
| `options.limit`  | Number  | The maximum number of items allowed in the queue (0 is not allow). |
| `options.log`    | Boolean | Enable or disable logging.                                         |

*Ex:*
```javascript
const queue = await dispatcher.createQueue("queue-1", {
  size: 8192,
  expire: 30 * 1000,
  limit: 100
});
```

### `getQueue(name)`
Retrieves an existing queue by name.
```javascript
const queue = dispatcher.getQueue("queue-1")
```

### `createWorker(name, options)`
Creates a new worker.

| Parameter        | Type    | Description                                                        |
| ---------------- | ------- | ------------------------------------------------------------------ |
| `name`           | String  | Name of Queue.                                                     |
| `options.log`    | Boolean | Enable or disable logging.                                         |
| `options.intervalRunJob`    | Number | The time interval is regularly triggered to rerun a job (default is 2000 ms). Make sure the job has initialized all concurrency and updated workMessages promptly.                                         |
| `options.priority`    | Number | Priority level will be approved first, if there is a message, and if the queue has another worker also listening, it will be checked first, if not, the new worker will be idled later. The larger the number, the higher the priority, default is 1.                                         |

*Ex:*
```javascript
const worker = await dispatcher.createWorker("worker-1", {
  log: true,
  intervalRunJob: 5000,
  priority: 2
});
```

### `getWorker(name)`
Retrieves an existing worker by name.

```javascript
const worker = dispatcher.getWorker("worker-1")

```

---

## Other
* [Queue](https://github.com/knfs-library/bbq/blob/master/docs/QUEUE.md)
* [Worker](https://github.com/knfs-library/bbq/blob/master/docs/WORKER.md)
* [Job](https://github.com/knfs-library/bbq/blob/master/docs/JOB.md)
* [Tips](https://github.com/knfs-library/bbq/blob/master/docs/TIP.md)