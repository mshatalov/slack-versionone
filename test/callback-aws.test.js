import test from 'ava';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

const config = {
  SLACK_TOKEN: 'test-slack-tocken',
  UNFURL_TOPIC: 'test-unfurl-token',
  AWS_REGION: 'test-region',
  AWS_SNS_TOPIC_ARN: 'test-sns-topic-arn'
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
  t.is(res.body, challenge.toString());
});

test('AWS handler - Require POST', async t => {
  const event = {
    httpMethod: 'GET'
  };

  const res = await callback.callback_aws(event);
  t.is(res.statusCode, 405);
  t.is(typeof res.body, 'string');
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

test.serial('AWS handler - link_shared event generates corresponding PubSub messages', async t => {
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

  const snsMock = {
    publish: sinon.stub().returns({ promise: sinon.stub().resolves({ MessageId: 'message-id' }) })
  };

  const sampleAwsQueue = proxyquire('../callback/queue-aws', {
    'aws-sdk': {
      SNS: sinon.stub().returns(snsMock)
    }
  });

  const sample = proxyquire('../callback', {
    './queue-aws': sampleAwsQueue
  });

  const res = await sample.callback_aws(event);

  t.is(snsMock.publish.callCount, 5);
  t.is(res.statusCode, 200);
});

test.serial('AWS handler passes through uncaught exceptions', async t => {
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
          { domain: 'www1.v1host.com', url: 'https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555' }
        ]
      }
    })
  };

  const sample = proxyquire('../callback', {
    './queue-aws': {
      publish: sinon.stub().rejects(new Error('some error'))
    }
  });

  await t.throwsAsync(async () => sample.callback_aws(event));
});

test.serial('AWS handler passes through uncaught SNS exceptions', async t => {
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
          { domain: 'www1.v1host.com', url: 'https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555' }
        ]
      }
    })
  };

  const snsMock = {
    publish: sinon.stub().returns({ promise: sinon.stub().rejects(new Error('SNS test error')) })
  };

  const sampleAwsQueue = proxyquire('../callback/queue-aws', {
    'aws-sdk': {
      SNS: sinon.stub().returns(snsMock)
    }
  });

  const sample = proxyquire('../callback', {
    './queue-aws': sampleAwsQueue
  });

  await t.throwsAsync(async () => sample.callback_aws(event));
});
