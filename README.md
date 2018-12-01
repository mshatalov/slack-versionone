## slack-v1
Basic [Slack](https://www.slack.com) and [VersionOne](https://www.collab.net/products/versionone) integration that supports links [unfurling](https://api.slack.com/docs/message-link-unfurling) for Stories and Defects.

### Requirements
The integration is implemented via [Google Cloud Functions](https://cloud.google.com/functions/) and [Google Cloud Pub/Sub](https://cloud.google.com/pubsub/) and thus requires GCP account for deployment. Keep in mind that Google Cloud Platform is a paid service and thus may incur real costs. There is a very nice [free tier](https://cloud.google.com/free/) however that may or may not work for you.

VersionOne version 18.3.2.31 was used to test the integration.

The code is simple enough to be adapted as an [Express](http://expressjs.com/) application and deployed as such within your environment if required.

### Limitations
* A single set of VersionOne user credentials is used to query the VersionOne API for all posted links.
* Your VersionOne installation should have API endpoint (`<Server Base URI>/rest-1.v1/Data/`) publicly available.

### Installation

The initial installation process is a little bit technical, but since you've landed here it must be safe to assume it is not a problem for your team.

#### Checkout the code
`git clone https://github.com/mshatalov/slack-versionone.git`

#### Create GCP project and enable Cloud Functions and Cloud Pub/Sub
If you don't yet have a GCP project, follow the official tutorials at https://cloud.google.com/functions/docs/quickstarts and https://cloud.google.com/pubsub/docs/quickstarts.

Make sure you have `gcloud` command-line tool installed.

#### Create Slack application
First, create a new Slack app for your workspace starting from https://api.slack.com/slack-apps. Take a look at [this](https://api.slack.com/docs/message-link-unfurling#setup) tutorial for more details.

Then, navigate to _Permissions_ (_OAuth & Permissions_) section, add `links:read` and `links:write` permission scopes, click _Save Changes_.

Next, click _Install App_ above on the same page.

Note the _OAuth Access Token_, it will be used for configuration, see below for details.

#### Configure the integration

The cloud functions are configured via environment variables that are setup in `env.callback.yaml` and `env.unfurl.yaml`. There are sample files, make sure to make a local copy and update the values as follows:

##### env.callback.yaml
* `SLACK_TOKEN` – Slack verification token that can be found on your app's _Basic Information_ page in _App Credentials_ section under _Verification Token_.
* `UNFURL_TOPIC` – A Pub/Sub topic name for the app. You can keep it unchanged.

##### env.unfurl.yaml
* `SLACK_OAUTH_TOKEN` – Slack application OAuth token noted above
* `V1_USER` – VersionOne username to be used to fetch data
* `V1_PASSWORD` – VersionOne user password
* `V1_URL_BASE` – VersionOne base URL, such as https://www1.v1host.com/MyInstance/

#### Deploy functions

We'll use `gcloud` command-line tool from the root directory of the project.

First, deploy the Slack callback handler:

`gcloud beta functions deploy slack-callback --source=./callback --entry-point=callback --trigger-http --runtime=nodejs8 --env-vars-file=env.callback.yaml`

Note the function URL in the output under the `httpsTrigger` section, we'll need it to finish Slack App configuration later on. It can be retrieved later via `gcloud functions describe slack-callback` or via the Console.

Then, deploy the function that performs link unfurling. Replace `--entry-point=unfurl` with the actual topic name if you changed it from the default in the `env.callback.yaml`.

`gcloud beta functions deploy slack-unfurl --source=./unfurl --entry-point=unfurl --trigger-topic=unfurl --runtime=nodejs8 --env-vars-file=env.unfurl.yaml`

#### Update Slack application with actual callback URL

Now, once we have a public Slack callback URL, we can finish Slack app configuration.

Navigate to the _Event Subscriptions_ section of your Slack app and follow the steps below:
* Enable Events
* Set _Request URL_ to the `slack-callback` function URL noted in the previous section
* Add `link_shared` workspace event
* Lists your VersionOne installation domain under _App Unfurl Domain_; it may include `https://` in front of the domain
* Don't forget to click _Save Changes_
* If Slack asks you to reinstall the app, follow the prompts and reinstall the app (we could avoid this step, but it'll require more back-and-forth)

You should be all set now! Go ahead and post these backlog item links to yourself to check that all works.

### Updates
If you need to update the configuration, or there is a new version of the code, just follow the steps in the [Deploy functions](#deploy-functions) section. There is no need to update Slack application as the callback URL stays unchanged between deployments.

### Troubleshooting

#### Check the logs
If something does not work, the best place to look first is the logs. You can access them either via Google Cloud console or using `gcloud`:

`gcloud functions logs read --limit=100`

