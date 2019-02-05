import test from 'ava';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

test.beforeEach(t => {
  sinon.stub(console, 'log');
  sinon.stub(console, 'error');
});

test.afterEach.always(t => {
  console.log.restore();
  console.error.restore();
});

test.serial('PubSub message with no data is parsed correctly', async t => {
  const unfurlStub = sinon.stub().resolves();
  const sample = proxyquire('../../unfurl', {
    './unfurl': {
      unfurl: unfurlStub
    }
  });

  const messageId = 'message-id-no-data';

  await sample.unfurl({}, { eventId: messageId });

  sinon.assert.calledWithExactly(unfurlStub, messageId, undefined, undefined, undefined);
  t.pass();
});

test.serial('PubSub messages are parsed correctly', async (t) => {
  const unfurlStub = sinon.stub().resolves();
  const sample = proxyquire('../../unfurl', {
    './unfurl': {
      unfurl: unfurlStub
    }
  });

  const link = 'https://test-url.com/path?key=value&key2=value2';
  const messageId = 'test-message-id';
  const ts = 'test-ts';
  const channel = 'test-channel';

  await sample.unfurl({
    data: Buffer.from(link).toString('base64'),
    attributes: { ts, channel }
  }, {
    eventId: messageId
  });

  sinon.assert.calledWithExactly(unfurlStub, messageId, link, ts, channel);
  t.pass();
});

test.serial('SNS message with no data is parsed correctly', async t => {
  const unfurlStub = sinon.stub().resolves();
  const sample = proxyquire('../../unfurl', {
    './unfurl': {
      unfurl: unfurlStub
    }
  });

  const messageId = 'message-id-no-data';

  await sample.unfurl_aws({
    Records: [{
      Sns: {
        MessageId: messageId,
        MessageAttributes: {}
      }
    }]
  });

  sinon.assert.calledWithExactly(unfurlStub, messageId, undefined, undefined, undefined);
  t.pass();
});

test.serial('SNS messages are parsed correctly', async (t) => {
  const unfurlStub = sinon.stub().resolves();
  const sample = proxyquire('../../unfurl', {
    './unfurl': {
      unfurl: unfurlStub
    }
  });

  const link = 'https://test-url.com/path?key=value&key2=value2';
  const messageId = 'test-message-id';
  const ts = 'test-ts';
  const channel = 'test-channel';

  await sample.unfurl_aws({
    Records: [{
      Sns: {
        Message: link,
        MessageId: messageId,
        MessageAttributes: {
          ts: { Value: ts, Type: 'String' },
          channel: { Value: channel, Type: 'String' }
        }
      }
    }]
  });

  sinon.assert.calledWithExactly(unfurlStub, messageId, link, ts, channel);
  t.pass();
});
