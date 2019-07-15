import throttle from './throttle';

class Queue {
  constructor({ maxWorkers = 1, delay = 0, paused = false } = {}) {
    this.maxWorkers = maxWorkers;
    this.fnDelay = delay;
    this.workers = 0;
    this.items = [];
    this.paused = paused;

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

  workersAvailable() {
    return this.workers < this.maxWorkers;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  process() {
    if (this.paused) {
      return;
    }

    return this.dequeue();
  }

  push(handler, context = null, ...args) {
    let safeHandler = handler;

    if (args.length) {
      safeHandler = handler.bind.apply(handler, [context].concat(...args));
    }

    this.items.push(safeHandler);

    this.process();
  }

  handleDone() {
    this.workers = this.workers - 1;
    
    setTimeout(this.process, this.fnDelay);
  }

  dequeue() {
    if (this.workersAvailable() && this.length()) {
      const toProcess = throttle(this.items.shift(), this.fnDelay);

      this.workers += 1;

      toProcess.call(null, this.handleDone);
    }
    
    if (!this.workers) {
      this.log("Nothing to do or workers unavailable");
      return;
    }

    if (!this.length()) {
      return Promise.resolve();
    }
  }
}

export default Queue;
