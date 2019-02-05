import test from 'ava';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

test('GCP handler passes through req and res object and correct queue implementation', async t => {
  const callbackStub = sinon.stub().resolves();
  const queueGcp = {
    '@noCallThru': true
  };
  const sample = proxyquire('../../callback', {
    './callback': { callback: callbackStub },
    './queue-gcp': queueGcp
  });

  const req = {};
  const res = {};

  await sample.callback(req, res);

  sinon.assert.calledWithExactly(
    callbackStub, sinon.match.same(queueGcp), sinon.match.same(req), sinon.match.same(res));
  t.pass();
});

test('GCP handler passes through uncaught exceptions', async t => {
  const callbackStub = sinon.stub().rejects(new Error('Unhandled unexpected error'));
  const queueGcp = {
    '@noCallThru': true
  };
  const sample = proxyquire('../../callback', {
    './callback': { callback: callbackStub },
    './queue-gcp': queueGcp
  });

  await t.throwsAsync(sample.callback({}, {}));
});

test('AWS handler translates AWS payload to default Express-stlye request', async t => {
  const method = 'POST';
  const body = {
    token: 'test-token',
    type: 'event_callback',
    event: {
      type: 'link_shared',
      message_ts: 'timestamp',
      channel: 'channel-id',
      links: [
        { domain: 'www1.v1host.com', url: 'https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555' }
      ]
    }
  };
  const event = {
    httpMethod: method,
    body: JSON.stringify(body)
  };

  const callbackStub = sinon.stub().resolves();
  const queueAws = {
    '@noCallThru': true
  };
  const sample = proxyquire('../../callback', {
    './callback': { callback: callbackStub },
    './queue-aws': queueAws
  });

  await sample.callback_aws(event);

  sinon.assert.calledWith(callbackStub, queueAws, { method, body });
  t.pass();
});

test('AWS handler translates default Express-stlye response to AWS response', async t => {
  const method = 'POST';
  const event = {
    httpMethod: method
  };

  const status400 = 400;
  const message400 = `HTTP ${status400} test`;

  const status200 = 200;
  const message200 = { json: true };

  const callbackStub = sinon.stub();
  const queueAws = {
    '@noCallThru': true
  };
  const sample = proxyquire('../../callback', {
    './callback': { callback: callbackStub },
    './queue-aws': queueAws
  });

  // code + string message
  callbackStub.callsFake((queueImpl, req, res) => res.status(status200).send(message200));
  let response = await sample.callback_aws(event);
  t.is(response.statusCode, status200);
  t.is(response.body, JSON.stringify(message200));

  // code + object message
  callbackStub.callsFake((queueImpl, req, res) => res.status(status400).send(message400));
  response = await sample.callback_aws(event);
  t.is(response.statusCode, status400);
  t.is(response.body, message400);

  // no explicit code + string message
  callbackStub.callsFake((queueImpl, req, res) => res.send(message400));
  response = await sample.callback_aws(event);
  t.is(response.statusCode, status200);
  t.is(response.body, message400);

  // code + no explicit message
  callbackStub.callsFake((queueImpl, req, res) => res.status(status400));
  response = await sample.callback_aws(event);
  t.is(response.statusCode, status400);
  t.is(response.body, '');
});

test('AWS handler passes through uncaught exceptions', async t => {
  const callbackStub = sinon.stub().rejects(new Error('Unhandled unexpected error'));
  const queueAws = {
    '@noCallThru': true
  };
  const sample = proxyquire('../../callback', {
    './callback': { callback: callbackStub },
    './queue-aws': queueAws
  });

  await t.throwsAsync(sample.callback_aws({}, {}));
});
