# Queue

## Overview

The `Queue` represents a message queue that stores messages and manages their processing. It supports message expiration and logging.

## API Reference

### Methods

#### addMessage(message): 
Adds a message to the queue.

*After being added, the message will be stored in the configured local storage, and broadcast to Dispatcher for distribution to registered Jobs.*

| Parameter        | Type    | Default | Description                                                        |
| ---------------- | ------- |------- |------------------------------------------------------------------ |
| `message`           | Object - Number - String  | |Message data                                                     |

*Ex:*
```javascript
const message1 = "message1"
const message2 = 2
const message3 = {
  msg: "message3",
  location: "Vietnam"
}
await queue.addMessage(message1);
await queue.addMessage(message2);
await queue.addMessage(message3);
```

#### reBroadCast(withMessageFail)

Rebroadcasts messages in the queue.
*In case there are messages available in the queue, you can use it to run*
| Parameter | Type                     | Default | Description  |
| --------- | ------------------------ |---------| ------------ |
| `withMessageFail` | bool | false | Run all failed messages |

*Ex:*
```javascript
// without message fail
await queue.reBroadCast()

// with message fail
await queue.reBroadCast(true)
```
---
## Other
* [Dispatcher](https://github.com/knfs-library/bbq/blob/master/docs/DISPATCHER.md)
* [Worker](https://github.com/knfs-library/bbq/blob/master/docs/WORKER.md)
* [Job](https://github.com/knfs-library/bbq/blob/master/docs/JOB.md)
* [Tips](https://github.com/knfs-library/bbq/blob/master/docs/TIP.md)