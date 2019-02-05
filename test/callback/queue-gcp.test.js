import test from 'ava';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

const config = {
  UNFURL_TOPIC: 'test-unfurl-token'
};
Object.assign(process.env, config);

test.before(t => {
  sinon.stub(console, 'log');
  sinon.stub(console, 'error');
});

test('GCP queue generates corresponding PubSub messages', async t => {
  const link = 'https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555';
  const ts = 'test-timestamp';
  const channel = 'test-channel';

  const pubsubMock = {
    topic: sinon.stub().returnsThis(),
    publisher: sinon.stub().returnsThis(),
    publish: sinon.stub().resolves('message-id')
  };

  const sampleGcpQueue = proxyquire('../../callback/queue-gcp', {
    '@google-cloud/pubsub': sinon.stub().returns(pubsubMock)
  });

  await sampleGcpQueue.publish(link, ts, channel);

  sinon.assert.calledWithExactly(pubsubMock.topic, config.UNFURL_TOPIC);
  sinon.assert.calledWithExactly(pubsubMock.publish, Buffer.from(link), { ts: ts, channel: channel });
  t.pass();
});

test.serial('GCP queue passes through uncaught PubSub exceptions', async t => {
  const link = 'https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555';
  const ts = 'test-timestamp';
  const channel = 'test-channel';

  const pubsubMock = {
    topic: sinon.stub().returnsThis(),
    publisher: sinon.stub().returnsThis(),
    publish: sinon.stub().rejects(new Error('Unexpected test PubSub error'))
  };

  const sampleGcpQueue = proxyquire('../../callback/queue-gcp', {
    '@google-cloud/pubsub': sinon.stub().returns(pubsubMock)
  });

  await t.throwsAsync(async () => sampleGcpQueue.publish(link, ts, channel));
});
