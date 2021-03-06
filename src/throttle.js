const throttle = function(func, wait, options = {}) {
  let timeout, context, args, result;
  let previous = 0;

  const later = function() {
    previous = options.leading === false ? 0 : Date.now()
    timeout = null;
    result = func.apply(context, args);
    
    if (!timeout) {
      context = null;
      args = null;
    }
  };

  const throttled = function(...args) {
    const now = Date.now();
    
    if (!previous && options.leading === false) {
      previous = now;
    }

    const remaining = wait - (now - previous);

    context = this;

    args = arguments;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }

      previous = now;
      result = func.apply(context, args);
      
      if (!timeout) {
        context = null;
        args = null
      }
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining);
    }
    return result;
  };

  throttled.cancel = function() {
    clearTimeout(timeout);
    previous = 0;
    timeout = context = args = null;
  };

  return throttled;
};

export default throttle;
