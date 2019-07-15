import WebSocket from 'isomorphic-ws';
import { socketConfigs } from './configs';

const socketConnectionURL = `${socketConfigs.url}:${socketConfigs.port}`;

const isValidWebSocket = socket => socket instanceof WebSocket ? true : false;

const socketWrapper = (socket) => {
  if(!isValidWebSocket(socket)) {
    throw new Error('A valid WebSocket instance must be provided');
  }

  return {
    listen(handler) {
      if (socket.onmessage) {
        // clear out any exisiting handlers.
        /**
         * TODO: do we need to wait for them to finish executing?
         * will there be race conditions between receiving a socket message
         * and resetting this? Do we need to actually close and reestablish a connection?
         * Might be a good idea to cache the current handler if we need to operate on it.
         * 
         * prop handler;
         * onmessage set to internal function that handles json parsing?
         * passes message, event to handler? In the case of an on disconnect
         * handler, execute the client's code, then our own?
         */
        socket.onmessage = null;
      }

      socket.onmessage = handler;
    },

    unlisten() {
      socket.onclose = function() {};
      socket.close();
    }
  };
};

let singleton;

const connect = () => {
  if (!singleton) {
    singleton = socketWrapper(new WebSocket(socketConnectionURL));
    window.onbeforeunload = singleton.unlisten;
  }

  return singleton;
};

export default connect;
