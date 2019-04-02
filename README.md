# slack-v1

## Overview
Basic [Slack](https://www.slack.com) and [VersionOne](https://www.collab.net/products/versionone) integration that supports links [unfurling](https://api.slack.com/docs/message-link-unfurling) for Stories and Defects.

### Requirements
The integration is designed for cloud deployment in either [Google Cloud Platform](https://cloud.google.com/) or [Amazon Web Services](https://aws.amazon.com/), and thus requires an account with one of the platforms. Keep in mind that both platforms are paid services and thus may incur real costs. There are very nice [GCP free tier](https://cloud.google.com/free/) and [AWS free tier](https://aws.amazon.com/free/) however that may or may not work for you.

The GCP deployment utilizes [Google Cloud Functions](https://cloud.google.com/functions/) and [Google Cloud Pub/Sub](https://cloud.google.com/pubsub/).

The AWS deployment utilizes [Amazon API Gateway](https://aws.amazon.com/api-gateway/), [AWS Lambda](https://aws.amazon.com/lambda/) and [Amazon Simple Notification Service](https://aws.amazon.com/sns/).

VersionOne version 18.3.2.31 was used to test the integration.

The code is simple enough to be adapted as an [Express](http://expressjs.com/) application and deployed as such within your environment.

### Limitations
* A single set of VersionOne user credentials is used to query the VersionOne API for all posted links.
* Your VersionOne installation should have API endpoint (`<Server Base URI>/rest-1.v1/Data/`) publicly available.

## Installation

### Prepare code and Slack app

The initial installation process is a little bit technical, but since you've landed here, it must be safe to assume it is not a problem for your team.

#### Checkout the code
`git clone https://github.com/mshatalov/slack-versionone.git`

#### Create Slack application
First, create a new Slack app for your workspace starting from https://api.slack.com/slack-apps. Take a look at [this](https://api.slack.com/docs/message-link-unfurling#setup) tutorial for more details.

Then, navigate to _Permissions_ (_OAuth & Permissions_) section, add `links:read` and `links:write` permission scopes, click _Save Changes_.

Next, click _Install App_ above on the same page.

Note the _OAuth Access Token_, it will be used for configuration, see below for details.

### GCP deployment
The sub-sections below cover GCP deployment. If you're deploying in AWS, skip this section and proceed to [AWS deployment](#aws-deployment) section.

#### Create GCP project and enable Cloud Functions and Cloud Pub/Sub
If you don't yet have a GCP project, follow the official tutorials at https://cloud.google.com/functions/docs/quickstarts and https://cloud.google.com/pubsub/docs/quickstarts.

Make sure you have `gcloud` command-line tool installed.

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

You're almost set.

### AWS deployment
The following sub-sections cover AWS deployment. If you're deploying in GCP, see the [GCP deploymnet](#gcp-deployment) section above.

#### AWS CLI tools
AWS deployment utilizes [AWS SAM](https://aws.amazon.com/serverless/sam/). Make sure you have [AWS Command Line Interface](https://docs.aws.amazon.com/cli/index.html) and [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-reference.html#serverless-sam-cli) installed.

#### Configure the integration
The cloud functions are configured via environment variables that are setup in `aws-sam.yaml` in `Variables` sections of `CallbackFunction` and `UnfurlFunction`. There is a sample file, make sure to make a local copy and update the values as follows:

##### CallbackFunction
* `SLACK_TOKEN` – Slack verification token that can be found on your app's _Basic Information_ page in _App Credentials_ section under _Verification Token_.

##### UnfurlFunction
* `SLACK_OAUTH_TOKEN` – Slack application OAuth token noted above
* `V1_USER` – VersionOne username to be used to fetch data
* `V1_PASSWORD` – VersionOne user password
* `V1_URL_BASE` – VersionOne base URL, such as https://www1.v1host.com/MyInstance/

#### Deploy functions

With AWS SAM deployment is very simple. Just execute the following commands from the root directory of the project, and you're all set.

First, build the application:

`sam build -t aws-sam.yaml`

Create an S3 bucket for deployment packages, if you don't have one. You can replace AWS S3 bucket name (`slack-v1-deploy`) with the one you prefer (in fact, you'll need to replace it with a unique name as S3 bucket names are global in AWS):

`aws s3 mb s3://slack-v1-deploy`

Package the deployment and upload the package to S3 bucket. Make sure that S3 bucket (`slack-v1-deploy`) in parameters below matches the one you created above:

`sam package --output-template-file packaged.yaml --s3-bucket slack-v1-deploy`

Finally, deploy the package. You can specify other [AWS region](https://docs.aws.amazon.com/general/latest/gr/rande.html) (`us-east-2` below) available for Lambdas if you wish:

`sam deploy --template-file packaged.yaml --stack-name slack-v1-sam --capabilities CAPABILITY_IAM --region us-east-2`

Now we need to get Slack callback URL to finalize Slack app configuration. Note `OutputValue` value for `CallbackURL` from the output of the command below:

`aws cloudformation describe-stacks --stack-name slack-v1-sam`

You're almost set.

### Finalize the Slack app configuration

#### Update Slack application with actual callback URL

Now, once we have a public Slack callback URL, we can finish Slack app configuration.

Navigate to the _Event Subscriptions_ section of your Slack app and follow the steps below:
* Enable Events
* Set _Request URL_ to the `slack-callback` function URL noted in the _Deploy functions_ sub-section 
* Add `link_shared` workspace event
* Lists your VersionOne installation domain under _App Unfurl Domain_; it may include `https://` in front of the domain
* Don't forget to click _Save Changes_
* If Slack asks you to reinstall the app, follow the prompts and reinstall the app (we could avoid this step, but it'll require more back-and-forth)

You should be all set now! Go ahead and post these backlog item links to yourself to check that all works.

### Updates
If you need to update the configuration, or there is a new version of the code, just follow the steps in the _Deploy functions_ sub-section of your hosting platform section. There is no need to update Slack application as the callback URL stays unchanged between deployments.

### Troubleshooting

#### Check the logs
If something does not work, the best place to look first is the logs.

You can check GCP logs either via Google Cloud console or using `gcloud`:

`gcloud functions logs read --limit=100`

AWS logs are in [AWS CloudWatch](https://aws.amazon.com/cloudwatch/).