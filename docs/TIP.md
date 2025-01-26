# Tips

### Queue
Queue will use both file and memory to balance storage and speed, so you need to be careful when configuring the queue.
- `secretKey`: You should use encryption for data to ensure safety.
- If your data size is large, you should edit `size` and `limit`  to ensure memory does not overflow and hard drive space does not run out.
- You should consider whether to retain the data or not. If it is only log data, you should set `expire`.

### Worker
Each `worker` can manage multiple `jobs`, 
There are many `workers` that can do the same `job`, but these `jobs` running on `workers` are independent and unrelated, only performing the same `job`, these `jobs` may or may not be listening to the same `queue`.
-  If your `Worker` is really important and there is a clearer hierarchy of which one should have `priority`, you should reset the `priority` for that `Worker`. You can also do this mechanism with `Job` by matching each worker with a `job` and setting the `priority` of that `job`.
-  If you are sure that your job runs very fast, and need it to run as close to real time as possible, you can reduce `intervalRunJob`. This will increase the timeliness of jobs.


### Job
- The `job` uses two mechanisms: the` main worker thread` for the **direct function** and the `child worker thread` for the **module path to run the job**. To use it, just replace the `job` pass from the function form and pass in the path to the function module to run the `job`.

- If your job is large and needs to run for a long time, you should consider resetting the `timeout` for that job
- If your job is an important job that needs to be retried immediately, you should reduce the `retryAfter` index
- You can speed up processing by increasing `concurrency` and `workingMessageCount`. But please note that this increase affects memory. You should only increase it for jobs with small message sizes and short processing times that require near real-time processing, such as message capture tasks.
- If during processing the worker thread encounters a problem when there are too many push events to process, you can increase `maxListeners`. In fact it rarely happens, when you have configured `workingMessageCount`, and `concurrency` the parameter we recommend:
   `maxListeners` > (`workingMessageCount`/`concurrency`)

## Other
* [Dispatcher](https://github.com/knfs-library/bbq/blob/master/docs/DISPATCHER.md)
* [Queue](https://github.com/knfs-library/bbq/blob/master/docs/QUEUE.md)
* [Worker](https://github.com/knfs-library/bbq/blob/master/docs/WORKER.md)
* [Job](https://github.com/knfs-library/bbq/blob/master/docs/JOB.md)