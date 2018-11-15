## slack-v1
Basic [Slack](https://www.slack.com) and [VersionOne](https://www.collab.net/products/versionone) integration that supports links [unfurling](https://api.slack.com/docs/message-link-unfurling) for Stories and Defects.

### Requirements
The integration is implemented via [Google Cloud Functions](https://cloud.google.com/functions/) and [Google Cloud PubSub](https://cloud.google.com/pubsub/) and thus requires GCP account for deployment.

VersionOne version 18.3.1.57 was used to test the integration.

The code is simple enough to be adapted as [Express](http://expressjs.com/) application and deployed as such within your environment if required.

### Limitations
* A single set of VersionOne user credentials is used to query the VersionOne API for all posted links.
* Your VersionOne installation should have API endpoint (`<Server Base URI>/rest-1.v1/Data/`) publicly available.

### Installation

#### Create Slack application

#### Create GCP project

#### Checkout the code

#### Configure the integration

#### Deploy functions

#### Update Slack applicatoin with actual callback URL


### Troubleshooting

#### Check the logs

