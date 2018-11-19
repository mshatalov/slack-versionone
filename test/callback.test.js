import test from "ava";
import sinon from "sinon";
import proxyquire from "proxyquire";

const config = {
    SLACK_TOKEN: "test-slack-tocken",
    UNFURL_TOPIC: "test-unfurl-token"
}
Object.assign(process.env, config);

const callback = require("../callback")
const PubSub = require("@google-cloud/pubsub")


function stubResponse() {
    return {
        status: sinon.stub().returnsThis(),
        send: sinon.stub().returnsThis()
    };
}

test.before(t => {
    sinon.stub(console, "log");
    sinon.stub(console, "error");
});

test("URL verification responds with correct challenge", async t => {
    const req = {
        method: "POST",
        body: {
            token: config.SLACK_TOKEN,
            type: "url_verification",
            challenge: Math.random() * 1000
        }
    };
    const res = stubResponse();

    await callback.callback(req, res);
    t.true(res.send.calledWith(req.body.challenge));
});

test("Require POST", async t => {
    const req = {
        method: "GET"
    };
    const res = stubResponse();

    await callback.callback(req, res);
    t.true(res.status.calledWith(405));
});

test("Slack token is verified on each request", async t => {
    const req = {
        method: "POST",
        body: {
            token: config.SLACK_TOKEN + "modified",
            type: "url_verification",
            challenge: Math.random() * 1000
        }
    };
    const res = stubResponse();

    await callback.callback(req, res);
    t.true(res.status.calledWith(401));
});

test("Empty links list generates no PubSub messages, but responds with 200", async t => {
    const req = {
        method: "POST",
        body: {
            token: config.SLACK_TOKEN,
            type: "event_callback",
            event: {
                type: "link_shared",
                links: []
            }
        }
    };
    const res = stubResponse();

    await callback.callback(req, res);
    t.true(res.status.calledWith(200));
});

test("link_shared event generates corresponding PubSub messages", async t => {
    const req = {
        method: "POST",
        body: {
            token: config.SLACK_TOKEN,
            type: "event_callback",
            event: {
                type: "link_shared",
                message_ts: "timestamp",
                channel: "channel-id",
                links: [
                    { domain: "www1.v1host.com", url: "https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555" },
                    { domain: "www1.v1host.com", url: "https://www1.v1host.com/sample/story.mvc/Summary?oidToken=tory%3A55555" },
                    { domain: "www1.v1host.com", url: "https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555" },
                    { domain: "www1.v1host.com", url: "https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story" },
                    { domain: "www1.v1host.com", url: "https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555" }
                ]
            }
        }
    };
    const res = stubResponse();

    const pubsubMock = {
        topic: sinon.stub().returnsThis(),
        publisher: sinon.stub().returnsThis(),
        publish: sinon.stub().resolves("message-id")
    };
    const sample = proxyquire("../callback", {
        "@google-cloud/pubsub": sinon.stub().returns(pubsubMock)
    });

    await sample.callback(req, res);
    t.true(pubsubMock.topic.calledWith(config.UNFURL_TOPIC));
    t.is(pubsubMock.publish.callCount, 5);
    t.true(res.status.calledWith(200));
});
