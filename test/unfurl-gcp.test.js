import test from 'ava';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

function invokeUnfurl (func, url, ts, channel, messageId) {
  return func({
    data: Buffer.from(url).toString('base64'),
    attributes: {
      ts: ts,
      channel: channel
    }
  }, { eventId: messageId || 'message-id' });
}

const unfurl = require('../unfurl');

test.beforeEach(t => {
  sinon.stub(console, 'log');
  sinon.stub(console, 'error');
});

test.afterEach.always(t => {
  console.log.restore();
  console.error.restore();
});

test.serial('PubSub message with no data is ignored', t => {
  unfurl.unfurl({}, { eventId: 'message-id-no-data' });
  t.true(console.error.called);
  t.is(console.error.args[0][0], 'Message message-id-no-data has no data');
});

test.serial('PubSub messages are parsed correctly', async (t) => {
  const unfurlStub = sinon.stub().resolves();
  const sample = proxyquire('../unfurl', {
    './unfurl': {
      unfurl: unfurlStub
    }
  });

  const link = 'https://test-url.com/path?key=value&key2=value2';
  const messageId = 'test-message-id';
  const ts = 'test-ts';
  const channel = 'test-channel';

  await invokeUnfurl(sample.unfurl, link, ts, channel, messageId);

  sinon.assert.calledWithExactly(unfurlStub, messageId, link, ts, channel);
  t.pass();
});
