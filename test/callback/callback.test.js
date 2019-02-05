import test from 'ava';
import sinon from 'sinon';

const config = {
  SLACK_TOKEN: 'test-slack-tocken'
};
Object.assign(process.env, config);

const callback = require('../../callback/callback');

function stubResponse () {
  return {
    status: sinon.stub().returnsThis(),
    send: sinon.stub().returnsThis()
  };
}

function stubQueue () {
  return { publish: sinon.stub().resolves('message-id') };
}

test.before(t => {
  sinon.stub(console, 'log');
  sinon.stub(console, 'error');
});

test('URL verification responds with correct challenge', async t => {
  const req = {
    method: 'POST',
    body: {
      token: config.SLACK_TOKEN,
      type: 'url_verification',
      challenge: Math.random() * 1000
    }
  };
  const res = stubResponse();
  const queueMock = stubQueue();

  await callback.callback(queueMock, req, res);

  sinon.assert.notCalled(queueMock.publish);
  t.true(res.send.calledWith(req.body.challenge));
});

test('Require POST', async t => {
  const req = {
    method: 'GET'
  };
  const res = stubResponse();
  const queueMock = stubQueue();

  await callback.callback(queueMock, req, res);

  sinon.assert.notCalled(queueMock.publish);
  t.true(res.status.calledWith(405));
});

test('Slack token is verified on each request', async t => {
  const req = {
    method: 'POST',
    body: {
      token: config.SLACK_TOKEN + 'modified',
      type: 'url_verification',
      challenge: Math.random() * 1000
    }
  };
  const res = stubResponse();
  const queueMock = stubQueue();

  await callback.callback(queueMock, req, res);

  sinon.assert.notCalled(queueMock.publish);
  t.true(res.status.calledWith(401));
});

test('Empty links list generates no PubSub messages, but responds with 200', async t => {
  const req = {
    method: 'POST',
    body: {
      token: config.SLACK_TOKEN,
      type: 'event_callback',
      event: {
        type: 'link_shared',
        links: []
      }
    }
  };
  const res = stubResponse();
  const queueMock = stubQueue();

  await callback.callback(queueMock, req, res);

  sinon.assert.notCalled(queueMock.publish);
  t.true(res.status.calledWith(200));
});

test('link_shared event generates corresponding PubSub messages', async t => {
  const event = {
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
  };
  const req = {
    method: 'POST',
    body: {
      token: config.SLACK_TOKEN,
      type: 'event_callback',
      event
    }
  };
  const res = stubResponse();
  const queueMock = stubQueue();

  await callback.callback(queueMock, req, res);

  sinon.assert.callCount(queueMock.publish, 5);
  for (let i = 0; i < event.links.length; ++i) {
    sinon.assert.calledWithExactly(
      queueMock.publish.getCall(i), event.links[i].url, event.message_ts, event.channel);
  }

  t.true(res.status.calledWith(200));
});

test.serial('Unexpected exceptions are passed through', async t => {
  const event = {
    type: 'link_shared',
    message_ts: 'timestamp',
    channel: 'channel-id',
    links: [
      { domain: 'www1.v1host.com', url: 'https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555' }
    ]
  };
  const req = {
    method: 'POST',
    body: {
      token: config.SLACK_TOKEN,
      type: 'event_callback',
      event
    }
  };
  const res = stubResponse();
  const queueMock = { publish: sinon.stub().rejects(new Error('Unexpected error')) };

  await t.throwsAsync(async () => callback.callback(queueMock, req, res));
});
