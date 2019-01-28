'use strict';

const config = require('./config');
let queue;

function verify (value, expected, errorMessage, errorCode) {
  if (value !== expected) {
    const error = new Error(errorMessage);
    error.code = errorCode;
    throw error;
  }
}

function route (key, handlers) {
  if (!(handlers && key && handlers[key])) {
    const error = new Error(`"${key}" is not supported`);
    error.code = 400;
    throw error;
  }
  return handlers[key];
}

async function handleLinkShared (req, res) {
  const event = req.body.event;
  const links = event && event.links;
  if (links) {
    console.log('Processing links ' + links.map(link => link.url));
    await Promise.all(links.map(link => queue.publish(link.url, event.message_ts, event.channel)));
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
      if (!res.headersSent) {
        res.status(err.code || 500).send(err);
      }
      return !err.code ? err : console.error(err);
    });
};

exports.callback = (req, res) => {
  queue = queue || require('./queue-gcp');
  return callback(req, res);
};

exports.callback_aws = async (event, context) => {
  queue = queue || require('./queue-aws');

  const req = { method: event.httpMethod };
  if (event.body !== undefined && event.body !== null) {
    req.body = JSON.parse(event.body);
  }

  const res = {
    _status: 200,
    _body: '',
    headersSent: false,
    status: function (code) { this._status = code; this.headersSent = true; return this; },
    send: function (body) { this._body = body; this.headersSent = true; return this; }
  };

  await callback(req, res);

  return {
    statusCode: res._status,
    body: res._body
  };
};
