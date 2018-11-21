'use strict';

const config = require('./config');
const PubSub = require('@google-cloud/pubsub');

const pubsub = new PubSub();

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
    await Promise.all(links.map(link => postUnfurlMessage(link.url, event.message_ts, event.channel)));
  } else {
    console.log('No links to process');
  }
  res.status(200).send('OK');
}

function postUnfurlMessage (link, ts, channel) {
  return pubsub
    .topic(config.UNFURL_TOPIC)
    .publisher()
    .publish(Buffer.from(link), { ts: ts, channel: channel })
    .then(id => console.log(`Posted ${id} for ${link} in ${channel} at ${ts}`))
    .catch(console.error);
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

exports.callback = (req, res) => {
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
