const QueueFactory = (function() {
  const initialState = {
    maxWorkers: 1,
    // time t wait before processing the next item in the queue
    fnDelay: 0,
    paused: false,
    // should the queue begin processing immediately upon recieving an item?
    eager: false
  };

  return function factory(options) {
    const queueOptions = {
      ...initialState,
      ...options
    };

    return new Queue(queueOptions);
  };
})();

class Queue {
  constructor(options) {
    Object.entries(options).forEach(([key, value]) => {
      this[key] = value;
    });

    // number of active workers processing queue items
    this.workers = 0;
    this.items = [];
    // is the queue currently processing an item
    this.working = false;

    this.handleDone = this.handleDone.bind(this);
    this.dequeue = this.dequeue.bind(this);
    this.process = this.process.bind(this);
  }

  length() {
    return this.items.length;
  }

  log(message) {
    console.log("Queue :: ", message);
  }

  allocateWorker() {
    const workerCount = this.workers + 1;
    this.workers = workerCount > this.maxWorkers ? this.maxWorkers : workerCount;
  }

  deallocateWorker() {
    const workerCount = this.workers - 1;
    this.workers = !workerCount ? 0 : workerCount;
  }

  workersAvailable() {
    return this.workers < this.maxWorkers && !this.isWorking();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  isWorking() {
    return this.working;
  }

  process() {
    if (this.paused || !this.workersAvailable()) {
      return;
    }

    return Promise.resolve(this.dequeue());
  }

  push(handler, context = null, ...args) {
    let safeHandler = handler;

    if (args.length) {
      safeHandler = handler.bind.apply(handler, [context].concat(...args));
    }

    this.items.push(safeHandler);

    if (this.eager) {
      this.process();
    }
  }

  handleDone() {
    this.deallocateWorker();
    this.working = false;
    return Promise.resolve(this.process());
  }

  dequeue() {
    if (!this.length()) {
      this.log("No work to perform");
      return Promise.resolve();
    }

    if (this.workersAvailable()) {
      this.working = true;

      const itemToProcess = this.items.shift();

      this.allocateWorker();

      return itemToProcess().then(this.handleDone);
    } else {
      this.log("Workers unavailable");
      this.dequeue();
    }
  }
}

export default QueueFactory;
