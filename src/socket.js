import WebSocket from 'isomorphic-ws';
import { socketConfigs } from './configs';

const longPollAdapter = ({ url }) => {
  let counter = 1;
  let timeout;

  const doPoll = (handler) => {
    return fetch(`${url}`)
      .then((request) => {
        if (request.ok) {
          return request.json();
        }

        return doPoll(handler)
      })
      .then((json) => {
        handler(json);

        timeout = setTimeout(() => {
          doPoll(handler)
        }, 300);
      });
  };

  return Promise.resolve({
    listen(handler) {
      doPoll(handler);
    },
    unlisten() {
      timeout && clearTimeout(timeout);
    }
  });
};

const webSocketAdapter = (() => {
  const socketConnectionURL = (url, port) => `${url}:${port}`;

  return ({ url, port }) => {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(socketConnectionURL(url, port));

      socket.onerror = (error) => {
        reject(error);
      };

      socket.onopen = () => {
        resolve({
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
            socket.onclose = function () { };
            socket.close();
          }
        }
        );
      };
    })
  };
})();

const makeConnection = ({ url, fallbackURL, port }) => {
  // return webSocketAdapter({ url, port })
  //   .then((socket) => {
  //     return Promise.resolve(socket);
  //   })
  //   .catch((e) => {
  return Promise.resolve(longPollAdapter({ url: fallbackURL }));
  //});
};

let singleton;

const connect = () => {
  return new Promise((resolve) => {
    if (singleton) {
      return resolve(singleton);
    }

    return resolve(makeConnection(socketConfigs));
  });
};

export default connect;
