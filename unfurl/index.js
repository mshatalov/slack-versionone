'use strict';

const config = require('./config');
const tiny = require('tiny-json-http');
const URL = require('url');

const validTypes = [ 'Story', 'Defect', 'Task' ];

function getV1ObjectFromURL (url) {
  if (!url.startsWith(config.V1_URL_BASE)) {
    throw new Error(`URL base is unknown, ignoring ${url}`);
  }

  const oid = URL.parse(url, true).query['oidToken'];
  if (!oid) {
    throw new Error(`Could not extract V1 oidToken, ignoring ${url}`);
  }

  const [ type, id ] = oid.split(':');
  if (id === undefined) {
    throw new Error(`Asset ID is missing, ignoring ${url}`);
  } else if (!validTypes.includes(type)) {
    throw new Error('Asset type ' + type + ' ignored (' + url + ')');
  }

  return getV1Object(type, id);
}

async function getV1Object (type, id) {
  const headers = { 'Authorization': 'Basic ' + Buffer.from(`${config.V1_USER}:${config.V1_PASSWORD}`).toString('base64') };
  const data = await tiny.get({
    url: config.V1_URL_BASE + '/rest-1.v1/Data/' + type + '/' + id + '?Accept=application/json&sel=Name,Number',
    headers
  });
  return data.body;
}

function v1ObjectToUnfurl (url, obj) {
  const attr = obj && obj.Attributes;
  if (attr && attr.Number && attr.Name) {
    const unfurl = {};
    unfurl[url] = {
      title: attr.Number.value,
      text: attr.Name.value,
      title_link: url
    };
    return unfurl;
  }
  throw new Error(`Could not extract details for ${url}`);
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

exports.unfurl = (data, context) => {
  const messageId = context.eventId;
  const link = (data.data && Buffer.from(data.data, 'base64').toString());
  if (!link) {
    console.error(`Message ${messageId} has no data`);
    return;
  }

  const ts = data.attributes.ts;
  const channel = data.attributes.channel;
  console.log(`Processing ${messageId} for ${link} in ${channel} at ${ts}`);
  return Promise.resolve()
    .then(() => getV1ObjectFromURL(link))
    .then(obj => postSlackUnfurlMessage({
      channel: channel,
      ts: ts,
      unfurls: v1ObjectToUnfurl(link, obj)
    }));
};
