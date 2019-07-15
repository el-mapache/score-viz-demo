import Queue from './queue';

const AnimationQueue = (...queueConfigs) => {
  const queues = queueConfigs.reduce((accum, { name, options }) => ({
    ...accum,
    [name]: new Queue(options)
  }), {});

  return {
    add(queueName, handler, context = null, ...args) {
      const queue = queues[queueName];
      
      queue && queue.push(handler, context, args);
    }
  }
}

// TODO extract locked into withSemaphore

const PriorityQueue = () => {
  const Bucket = ({ id }) => {
    const highPriority = new Queue();
    const lowPriority = new Queue();
    
    let locked = false;

    return {
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
      process() {
        if (locked) {
          return;
        }
        
        highPriority.process().then(() => {
          lowPriority.process()
        });
      }
    }
  }
};

export default AnimationQueue;
