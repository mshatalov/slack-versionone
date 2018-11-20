import test from 'ava';
import sinon from 'sinon';
import nock from 'nock';

const config = {
  SLACK_OAUTH_TOKEN: 'slack-oauth-token',
  V1_USER: 'v1-user',
  V1_PASSWORD: 'v1-password',
  V1_URL_BASE: 'https://www1.v1host.com/sample'
};
Object.assign(process.env, config);

const unfurl = require('../unfurl');

function mockV1 (type, id, code, responsePathV1) {
  return nock(config.V1_URL_BASE)
    .get(`/rest-1.v1/Data/${type}/${id}`)
    .basicAuth({
      user: config.V1_USER,
      pass: config.V1_PASSWORD
    })
    .query({ Accept: 'application/json', sel: 'Name,Number' })
    .replyWithFile(code, `${__dirname}/${responsePathV1}`, { 'Content-Type': 'application/json' });
}

function mockSlack (ts, channel, unfurls, code, response) {
  return nock('https://slack.com/', {
    reqheaders: {
      Authorization: `Bearer ${config.SLACK_OAUTH_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8'
    }
  })
    .post('/api/chat.unfurl', {
      ts: ts,
      channel: channel,
      unfurls: unfurls
    })
    .reply(code || '200', response || { ok: true });
}

function makeUnfurl (url, responsePathV1) {
  const rawV1Response = require(responsePathV1);
  const expectedUnfurls = {};
  expectedUnfurls[url] = {
    title: rawV1Response.Attributes.Number.value,
    text: rawV1Response.Attributes.Name.value
  };
  return expectedUnfurls;
}

function makeV1URL (type, id) {
  return `${config.V1_URL_BASE}/story.mvc/Summary?oidToken=${type}%3A${id}`;
}

function invokeUnfurl (url, ts, channel, messageId) {
  return unfurl.unfurl({
    data: Buffer.from(url).toString('base64'),
    attributes: {
      ts: ts,
      channel: channel
    }
  }, { eventId: messageId || 'message-id' });
}

async function testSuccessfulUnfurl (t, type, id, responsePathV1, code) {
  const ts = 'timestamp-explicit';
  const channel = 'channel-explicit';
  const messageId = 'message-id-1';
  const url = makeV1URL(type, id);

  const scopeSlack = mockSlack(ts, channel, makeUnfurl(url, responsePathV1));
  const scopeV1 = mockV1(type, id, code || 200, responsePathV1);

  await invokeUnfurl(url, ts, channel, messageId);

  t.notThrows(() => scopeV1.done());
  t.notThrows(() => scopeSlack.done());

  t.true(console.log.called);
  t.is(console.log.args[0][0], `Processing ${messageId} for ${url} in ${channel} at ${ts}`);
}

test.beforeEach(t => {
  sinon.stub(console, 'log');
  sinon.stub(console, 'error');
});

test.afterEach.always(t => {
  console.log.restore();
  console.error.restore();
  nock.cleanAll();
});

test.serial('Unfurl parses V1 response and posts an unfurl to Slack: Story', async t =>
  testSuccessfulUnfurl(t, 'Story', 55555, './replies/v1-story-55555.json')
);

test.serial('Unfurl parses V1 response and posts an unfurl to Slack: Defect', async t =>
  testSuccessfulUnfurl(t, 'Defect', 33333, './replies/v1-defect-33333.json')
);

test.serial('Reports error if V1 returns non-200', async t => {
  const code = 401;
  await t.throwsAsync(
    testSuccessfulUnfurl(t, 'Story', 55555, './replies/v1-story-55555.json', code),
    { instanceOf: Error, message: `V1 responded with ${code} HTTP code` }
  );
});

test.serial('Reports error if Slack returns non-200', async t => {
  const path = './replies/v1-story-55555.json';
  const url = makeV1URL('Story', 55555);
  mockV1('Story', 55555, 200, path);
  mockSlack('mock-ts', 'mock-ch', makeUnfurl(url, path), 400);

  await t.throwsAsync(invokeUnfurl(url, 'mock-ts', 'mock-ch'), { instanceOf: Error, message: /400/ });
});

test.serial('Reports error if Slack return ok: false', async t => {
  const path = './replies/v1-story-55555.json';
  const url = makeV1URL('Story', 55555);
  mockV1('Story', 55555, 200, path);
  mockSlack('mock-ts', 'mock-ch', makeUnfurl(url, path), 200, { ok: false });

  await t.throwsAsync(invokeUnfurl(url, 'mock-ts', 'mock-ch'), { instanceOf: Error, message: /non-OK/ });
});

test.serial('Only Story and Defect asset types supported', async t => {
  const url = `${config.V1_URL_BASE}/story.mvc/Summary?oidToken=Epic%3A11111`;
  await t.throwsAsync(invokeUnfurl(url, 'ts', 'ch'), { instanceOf: Error, message: /Epic/ });
});

test.serial('Only Story and Defect asset types supported, case sensitive', async t => {
  const url = `${config.V1_URL_BASE}/story.mvc/Summary?oidToken=story%3A11111`;
  await t.throwsAsync(invokeUnfurl(url, 'ts', 'ch'), { instanceOf: Error, message: /story/ });
});
