import test from 'ava';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

const config = {
  AWS_REGION: 'test-region',
  AWS_SNS_TOPIC_ARN: 'test-sns-topic-arn'
};
Object.assign(process.env, config);

test.before(t => {
  sinon.stub(console, 'log');
  sinon.stub(console, 'error');
});

test.serial('AWS queue generates corresponding SNS messages', async t => {
  const link = 'https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555';
  const ts = 'test-timestamp';
  const channel = 'test-channel';

  const snsMock = {
    publish: sinon.stub().returns({ promise: sinon.stub().resolves({ MessageId: 'message-id' }) })
  };
  const snsConsructorMock = sinon.stub().returns(snsMock);

  const sampleAwsQueue = proxyquire('../../callback/queue-aws', {
    'aws-sdk': {
      SNS: snsConsructorMock
    }
  });

  await sampleAwsQueue.publish(link, ts, channel);

  sinon.assert.calledWithExactly(snsConsructorMock, { region: config.AWS_REGION, apiVersion: '2010-03-31' });
  sinon.assert.calledWithExactly(snsMock.publish, {
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
  });
  t.pass();
});

test.serial('AWS queue passes through uncaught SNS exceptions', async t => {
  const link = 'https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555';
  const ts = 'test-timestamp';
  const channel = 'test-channel';

  const snsMock = {
    publish: sinon.stub().returns({ promise: sinon.stub().rejects(new Error('SNS test error')) })
  };

  const sampleAwsQueue = proxyquire('../../callback/queue-aws', {
    'aws-sdk': {
      SNS: sinon.stub().returns(snsMock)
    }
  });

  await t.throwsAsync(async () => sampleAwsQueue.publish(link, ts, channel));
});
