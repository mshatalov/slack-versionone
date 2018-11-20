'use strict';

const config = require('./config');
const tiny = require('tiny-json-http');
const URL = require('url');

function getV1ObjectFromURL (url) {
  if (!url.startsWith(config.V1_URL_BASE)) {
    throw new Error(`URL ${url} ignored`);
  }

  const oid = URL.parse(url, true).query['oidToken'];
  if (oid == null) {
    throw new Error(`Could not extract V1 oidToken, ignoring ${url}`);
  }

  let oidParts = oid.split(':');
  if (oidParts.length < 2) {
    throw new Error(`Asset ID is missing, ignoring ${url}`);
  }

  let type = oidParts[0];
  if (type !== 'Story' && type !== 'Defect') {
    throw new Error('Asset type ' + type + ' ignored (' + url + ')');
  }

  return getV1Object(type, oidParts[1]);
}

async function getV1Object (type, id) {
  const headers = { 'Authorization': 'Basic ' + Buffer.from(`${config.V1_USER}:${config.V1_PASSWORD}`).toString('base64') };
  const data = await tiny.get({
    url: config.V1_URL_BASE + '/rest-1.v1/Data/' + type + '/' + id + '?Accept=application/json&sel=Name,Number',
    headers
  });
  return data.body;
}

function parseV1Object (obj) {
  const attr = obj && obj.Attributes;
  if (attr && attr.Number && attr.Name) {
    return {
      title: attr.Number.value,
      text: attr.Name.value
    };
  }
  return null;
}

function postSlackUnfurlMessage (message) {
  const headers = { Authorization: `Bearer ${config.SLACK_OAUTH_TOKEN}` };
  return tiny
    .post({
      url: 'https://slack.com/api/chat.unfurl',
      headers,
      data: message
    })
    .then(res => {
      if (res.body.ok !== true) {
        throw new Error(`Slack API responded with non-OK, response: ${res.body}`);
      }
    });
}

function unfurl (data, context) {
  const messageId = context.eventId;
  const link = data.data ? Buffer.from(data.data, 'base64').toString() : null;
  if (link === null) {
    console.error(`Message ${messageId} has no data`);
    return;
  }

  const ts = data.attributes.ts;
  const channel = data.attributes.channel;
  console.log(`Processing ${messageId} for ${link} in ${channel} at ${ts}`);
  return Promise.resolve()
    .then(() => getV1ObjectFromURL(link))
    .then(v1Asset => {
      let unfurl = {};
      unfurl[link] = parseV1Object(v1Asset);
      if (unfurl[link] !== null) {
        return postSlackUnfurlMessage({
          channel: channel,
          ts: ts,
          unfurls: unfurl
        });
      } else {
        throw new Error(`Could not extract details for ${link}`);
      }
    });
}

exports.unfurl = unfurl;
