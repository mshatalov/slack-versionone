'use strict';

const config = require('./config');
const PubSub = require('@google-cloud/pubsub');

const pubsub = new PubSub();

function verifyHttpMethod (req) {
  if (!req || req.method !== 'POST') {
    const error = new Error('POST expected');
    error.code = 405;
    throw error;
  }
}

function verifySlackToken (body) {
  if (!body || body.token !== config.SLACK_TOKEN) {
    const error = new Error('Invalid credentials');
    error.code = 401;
    throw error;
  }
}

function routeSlackCallback (req, res) {
  var type = req.body != null ? req.body.type : null;

  if (type === null || callbackHandlers[type] === null) {
    const error = new Error(`Callback of "${type}" type is not supported`);
    error.code = 400;
    throw error;
  }

  return callbackHandlers[type](req, res);
}

function handleEventCallback (req, res) {
  const event = req.body.event;
  const type = (event !== null && event.type) || null;

  if (type === null || eventHandlers[type] === null) {
    const error = new Error(`Event type "${type}" is not supported`);
    error.code = 400;
    throw error;
  }

  return eventHandlers[type](req, res);
}

async function handleLinkShared (req, res) {
  const body = req.body;
  const event = body.event;
  const links = event.links;
  if (links !== null) {
    console.log('Processing links ' + links.map(l => l.url));
    await Promise.all(links.map(l => postUnfurlMessage(l.url, event.message_ts, event.channel)));
  } else {
    console.log('No links to process');
  }
  res.status(200).send('OK');
}

async function postUnfurlMessage (link, ts, channel) {
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

function callback (req, res) {
  return Promise.resolve()
    .then(() => {
      verifyHttpMethod(req);
      verifySlackToken(req.body);
      return routeSlackCallback(req, res);
    })
    .catch(err => {
      if (!res.headersSent) {
        res.status(err.code || 500).send(err);
      }
      return !err.code ? err : console.error(err);
    });
}

const callbackHandlers = {
  'url_verification': handleUrlVerification,
  'event_callback': handleEventCallback
};

const eventHandlers = {
  'link_shared': handleLinkShared
};

exports.callback = callback;
