import test from "ava";
import sinon from "sinon";

const unfurl = require("../unfurl")


test.before(t => {
    sinon.stub(console, "log");
    sinon.stub(console, "error");
});

test.skip("Unfurl gets real V1 data and tries to post it to Slack", t => {
    return unfurl.unfurl({
        data: new Buffer("https://www1.v1host.com/sample/story.mvc/Summary?oidToken=Story%3A55555").toString('base64'),
        attributes: {
            ts: "timestamp",
            channel: "channel"
        }
    },
    {
        eventId: "message-id"
    });
})