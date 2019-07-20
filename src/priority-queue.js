import QueueFactory from './queue';

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
      hpq() {
        return highPriority;
      },
      lpq() {
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
        return lowPriority.process();
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
        if (this.isLocked()) {
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
