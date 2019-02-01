import test from 'ava';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

const config = {
  SLACK_TOKEN: 'test-slack-tocken',
  UNFURL_TOPIC: 'test-unfurl-token',
  AWS_REGION: 'test-region',
  AWS_SQS_QUEUE_NAME: 'test-sqs-queue-name'
};
Object.assign(process.env, config);

const callback = require('../callback');

test.before(t => {
  sinon.stub(console, 'log');
  sinon.stub(console, 'error');
});

test('AWS handler - URL verification responds with correct challenge', async t => {
  const challenge = Math.random() * 1000;
  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      token: config.SLACK_TOKEN,
      type: 'url_verification',
      challenge
    })
  };

  const res = await callback.callback_aws(event);
  t.is(res.statusCode, 200);
  t.is(res.body, challenge);
});

test('AWS handler - Require POST', async t => {
  const event = {
    httpMethod: 'GET'
  };

  const res = await callback.callback_aws(event);
  t.is(res.statusCode, 405);
});

test('AWS handler - Slack token is verified on each request', async t => {
  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      token: config.SLACK_TOKEN + 'modified',
      type: 'url_verification',
      challenge: Math.random() * 1000
    })
  };

  const res = await callback.callback_aws(event);
  t.is(res.statusCode, 401);
});

test('AWS handler - Empty links list generates no PubSub messages, but responds with 200', async t => {
  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      token: config.SLACK_TOKEN,
      type: 'event_callback',
      event: {
        type: 'link_shared',
        links: []
      }
    })
  };

  const res = await callback.callback_aws(event);
  t.is(res.statusCode, 200);
});

test('AWS handler - link_shared event generates corresponding PubSub messages', async t => {
  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      token: config.SLACK_TOKEN,
      type: 'event_callback',
      event: {
        type: 'link_shared',
        message_ts: 'timestamp',
        channel: 'channel-id',
        links: [
          { domain: 'www1.v1host.com', url: 'https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555' },
          { domain: 'www1.v1host.com', url: 'https://www1.v1host.com/sample/story.mvc/Summary?oidToken=tory%3A55555' },
          { domain: 'www1.v1host.com', url: 'https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555' },
          { domain: 'www1.v1host.com', url: 'https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story' },
          { domain: 'www1.v1host.com', url: 'https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555' }
        ]
      }
    })
  };

  const sqsMock = {
    getQueueUrl: sinon.stub().returns({ promise: sinon.stub().resolves({ QueueUrl: 'test-queue-url' }) }),
    sendMessage: sinon.stub().returns({ promise: sinon.stub().resolves({ MessageId: 'message-id' }) })
  };

  const sampleAwsQueue = proxyquire('../callback/queue-aws', {
    'aws-sdk': {
      SQS: sinon.stub().returns(sqsMock)
    }
  });

  const sample = proxyquire('../callback', {
    './queue-aws': sampleAwsQueue
  });

  const res = await sample.callback_aws(event);

  sinon.assert.calledOnce(sqsMock.getQueueUrl);
  sinon.assert.calledWithMatch(sqsMock.getQueueUrl, { QueueName: config.AWS_SQS_QUEUE_NAME });
  t.is(sqsMock.sendMessage.callCount, 5);
  t.is(res.statusCode, 200);
});