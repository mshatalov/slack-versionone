'use strict';

const config = require('./config');

const PubSub = require('@google-cloud/pubsub');
const pubsub = new PubSub();

exports.publish = (link, ts, channel) => {
  return pubsub
    .topic(config.UNFURL_TOPIC)
    .publisher()
    .publish(Buffer.from(link), { ts: ts, channel: channel })
    .then(id => console.log(`Posted ${id} for ${link} in ${channel} at ${ts}`))
    .catch(console.error);
};
