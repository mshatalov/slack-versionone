const { callback } = require('./callback');

let queue;

exports.callback = async (req, res) => {
  queue = queue || require('./queue-gcp');
  return callback(queue, req, res);
};

exports.callback_aws = async (event, context) => {
  queue = queue || require('./queue-aws');

  const req = { method: event.httpMethod };
  if (event.body !== undefined && event.body !== null) {
    req.body = JSON.parse(event.body);
  }

  const res = {
    _status: 200,
    _body: '',
    headersSent: false,
    status: function (code) { this._status = code; this.headersSent = true; return this; },
    send: function (body) { this._body = body; this.headersSent = true; return this; }
  };

  await callback(queue, req, res);

  return {
    statusCode: res._status,
    body: res._body
  };
};
