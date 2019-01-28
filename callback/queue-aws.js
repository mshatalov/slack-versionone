'use strict';

const config = require('./config');

const AWS = require('aws-sdk');
const sqs = new AWS.SQS({ region: config.AWS_REGION, apiVersion: '2012-11-05' });

let queueUrl;

const getQueueUrl = async () => {
  if (queueUrl) {
    try {
      return (await queueUrl).QueueUrl;
    } catch (e) {
      console.error('Could not get SQS queue URL last time, will try again now');
    }
  }
  queueUrl = sqs.getQueueUrl({ QueueName: config.AWS_SQS_QUEUE_NAME }).promise();
  return (await queueUrl).QueueUrl;
};

exports.publish = (link, ts, channel) => {
  return getQueueUrl()
    .then(url => ({
      QueueUrl: url,
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
      MessageBody: link
    }))
    .then(params => sqs.sendMessage(params).promise())
    .then(result => console.log(`Posted ${result.MessageId} for ${link} in ${channel} at ${ts}`))
    .catch(console.error);
};
