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
    this.workers = this.workers + 1;
  }

  deallocateWorker() {
    this.workers = this.workers - 1;
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
    if (this.paused || this.working) {
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
    if (this.workersAvailable() && this.length()) {
      this.working = true;

      const itemToProcess = this.items.shift();

      this.allocateWorker();

      return itemToProcess().then(this.handleDone);
    } else if (!this.workersAvailable()) {
      this.log("Workers unavailable");
      this.dequeue();
    } else if (!this.length()) {
      this.log("No work to perform");
      return Promise.resolve();
    }
  }
}

const PriorityQueue = ({ id }) => {
  const highPriority = QueueFactory({ eager: false });
  const lowPriority = QueueFactory({ eager: false, maxWorkers: 10 });

  const addToPriorityQueue = (queue, ...args) => {
    queue.push(...args);
  };

  const hasHighPriorityWork = () => {
    return !highPriorityFinished && typeof highPriorityFinished !== "undefined";
  };

  let locked = false;
  let highPriorityFinished;

  return {
      hp() {
        return highPriority;
      },
      lp() {
        return lowPriority;
      },
      id() {
        return id;
      },
      isLocked() {
        return locked;
      },
      lock() {
        locked = true;
      },
      unlock() {
        locked = false;
      },
      busy() {
        return hasHighPriorityWork();
      },
      flush() {
        lowPriority.process();
      },
      pushHighPriority(handler, context = null, ...args) {
        // if a new high priority item is added while the queue is processing
        // pause execution of the low priority queue. the next call to process
        // will then handle the next high priority item(s)
        lowPriority.pause();
        highPriorityFinished = false;
        addToPriorityQueue(highPriority, handler, context, args);        
        
        if (highPriority.workersAvailable()) {
          this.process();
        }
      },
      pushLowPriority(handler, context = null, ...args) {
        addToPriorityQueue(lowPriority, handler, context, args);

        if (!hasHighPriorityWork() && lowPriority.workersAvailable()) {
          lowPriority.process();
        }
      },
      process() {
        if (locked) {
          return Promise.reject();
        }

        if (!hasHighPriorityWork()) {
          lowPriority.resume();
          return lowPriority.process();
        }

        return highPriority
          .process()
          .then(() => {
            highPriorityFinished = true;
            lowPriority.resume();
            return lowPriority.process();
          })
          .then(() => {  
            return Promise.resolve();
          })
          .catch(e => console.log("catching", e));
      }
  };
};

export default PriorityQueue;
