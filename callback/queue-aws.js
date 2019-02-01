'use strict';

const config = require('./config');

const AWS = require('aws-sdk');
const sns = new AWS.SNS({ region: config.AWS_REGION, apiVersion: '2010-03-31' });

exports.publish = (link, ts, channel) => {
  return sns.publish({
    TopicArn: config.AWS_SNS_TOPIC_ARN,
    MessageAttributes: {
      ts: {
        DataType: 'String',
        StringValue: ts
      },
      channel: {
        DataType: 'String',
        StringValue: channel
      }
    },
    Message: link
  }).promise()
    .then(result => console.log(`Posted ${result.MessageId} for ${link} in ${channel} at ${ts}`))
    .catch(console.error);
};
