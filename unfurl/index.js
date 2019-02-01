const { unfurl } = require('./unfurl');

exports.unfurl = (data, context) => {
  const messageId = context.eventId;
  const link = (data.data && Buffer.from(data.data, 'base64').toString());
  if (!link) {
    console.error(`Message ${messageId} has no data`);
    return;
  }

  const { ts, channel } = data.attributes;
  return unfurl(messageId, link, ts, channel);
};

exports.unfurl_aws = async (event) => {
  const sns = event.Records[0].Sns;
  const {
    Message: link,
    MessageId: messageId,
    MessageAttributes: {
      ts: { Value: ts },
      channel: { Value: channel }
    }
  } = sns;

  return unfurl(messageId, link, ts, channel);
};
