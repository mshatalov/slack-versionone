"use strict";

const config = require("./config");
const https = require("https");
const URL = require("url");


function getV1ObjectFromURL(url) {
    if (!url.startsWith(config.V1_URL_BASE)) {
        throw new Error(`URL ${url} ignored`);
    }

    let parsedUrl = URL.parse(url, true);
    let oid = parsedUrl.query["oidToken"];

    if (oid == null) {
        throw new Error(`Could not extract V1 oidToken, ignoring ${url}`);
    }

    let oidParts = oid.split(":");
    if (oidParts.length < 2) {
        throw new Error(`Asset ID is missing, ignoring ${url}`);
    }
    
    let type = oidParts[0];
    if (type != "Story" && type != "Defect") {
        throw new Error("Asset type " + type + " ignored (" + url + ")");
    }

    return getV1Object(type, oidParts[1]);
}

function getV1Object(type, id) {
    return new Promise((resolve, reject) => {
        const url = URL.parse(config.V1_URL_BASE + "/rest-1.v1/Data/" + type + "/" + id + "?Accept=application/json&sel=Name,Number", true);
        url.auth = `${config.V1_USER}:${config.V1_PASSWORD}`;

        let data = "";
        https.get(url, (res) => {
                if (res.statusCode != 200) {
                    res.resume();
                    return reject(new Error(`V1 responded with ${res.statusCode} HTTP code`));
                }
                res.on("data", chunk => { data += chunk; });
                res.on("end", () => resolve(JSON.parse(data)));
            }).on("error", reject);
        });
}

function convertV1AssetToUnfurl(asset) {
    if (asset === null || asset.Attributes === null) {
        return null;
    }

    var attrs = asset.Attributes;
    return attrs.Number || attrs.Name
        ? {
            title: attrs.Number != null ? attrs.Number.value : null,
            text: attrs.Name != null ? attrs.Name.value : null
        }
        : null;
}

function postSlackUnfurlMessage(message) {
    const postData = JSON.stringify(message);
    return new Promise((resolve, reject) => {
        let data = "";
        const request = https.request({
            hostname: "slack.com",
            path: "/api/chat.unfurl",
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Length": Buffer.byteLength(postData),
                "Authorization": `Bearer ${config.SLACK_OAUTH_TOKEN}`
            }
        }, (res) => {
            if (res.statusCode != 200) {
                res.resume();
                return reject(new Error(`Failed to post Slack message: got ${res.statusCode} HTTP code`));
            };

            res.on("data", chunk => { data += chunk; });
            res.on("end", () => {
                var parsedData = JSON.parse(data);
                if (parsedData === null || parsedData.ok !== true) {
                    return reject(`Slack API responded with non-OK, response: ${parsedData} (raw: ${data})`);
                }
                resolve();
            });
        });
        request.on("error", reject);
        
        request.write(postData);
        request.end();
    });
}

function unfurl(data, context) {
    const messageId = context.eventId;
    const link = data.data ? Buffer.from(data.data, 'base64').toString() : null;
    if (link === null) {
        console.error(`Message ${messageId} has no data`);
        return;
    }

    const ts = data.attributes.ts;
    const channel = data.attributes.channel;
    console.log(`Processing ${messageId} for ${link} in ${channel} at ${ts}`)
    return getV1ObjectFromURL(link)
        .then(v1Asset => {
            let unfurl = {};
            unfurl[link] = convertV1AssetToUnfurl(v1Asset);
            if (unfurl[link] !== null) {
                return postSlackUnfurlMessage({
                    channel: channel,
                    ts: ts,
                    unfurls: unfurl
                });
            }
            else {
                console.error(`Could not extract details for ${link}`);
            }
        })
        .catch(console.error);
}

exports.unfurl = unfurl;
