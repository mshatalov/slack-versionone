const { unfurl } = require('./unfurl');

exports.unfurl = (data, context) => {
  const messageId = context.eventId;
  const link = (data.data && Buffer.from(data.data, 'base64').toString());

  const { ts, channel } = data.attributes || {};
  return unfurl(messageId, link, ts, channel);
};

exports.unfurl_aws = async (event) => {
  const sns = event.Records[0].Sns;
  const {
    Message: link,
    MessageId: messageId,
    MessageAttributes: attrs
  } = sns;
  const ts = attrs && attrs.ts && attrs.ts.Value;
  const channel = attrs && attrs.channel && attrs.channel.Value;

  return unfurl(messageId, link, ts, channel);
};
