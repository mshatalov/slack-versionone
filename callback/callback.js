'use strict';

const config = require('./config');
let queueImpl;

class SlackV1Error extends Error {
  constructor (message, code) {
    super(message);
    this.code = code;
  }
}

function verify (value, expected, errorMessage, errorCode) {
  if (value !== expected) {
    throw new SlackV1Error(errorMessage, errorCode);
  }
}

function route (key, handlers) {
  if (!(handlers && key && handlers[key])) {
    throw new SlackV1Error(`"${key}" is not supported`, 400);
  }
  return handlers[key];
}

async function handleLinkShared (req, res) {
  const event = req.body.event;
  const links = event && event.links;
  if (links) {
    console.log('Processing links ' + links.map(link => link.url));
    await Promise.all(links.map(link => queueImpl.publish(link.url, event.message_ts, event.channel)));
  } else {
    console.log('No links to process');
  }
  res.status(200).send('OK');
}

function handleUrlVerification (req, res) {
  console.log('URL verification request');
  return res.send(req.body.challenge);
}

const eventHandlers = {
  'link_shared': handleLinkShared
};

const callbackHandlers = {
  'url_verification': handleUrlVerification,
  'event_callback': (req, res) => route(req.body.event && req.body.event.type, eventHandlers)(req, res)
};

const callback = (req, res) => {
  return Promise.resolve()
    .then(() => {
      verify(req && req.method, 'POST', 'POST expected', 405);
      verify(req.body && req.body.token, config.SLACK_TOKEN, 'Invalid credentials', 401);
      return route(req.body.type, callbackHandlers)(req, res);
    })
    .catch(err => {
      if (!res.headersSent && err instanceof SlackV1Error) {
        console.error(err.message);
        res.status(err.code).send(err);
      } else {
        throw err;
      }
    });
};

exports.callback = (queue, req, res) => {
  queueImpl = queue;
  return callback(req, res);
};
