const DiscordWebhookTransport = require("@typicalninja21/discord-winston");

// prettier-ignore
module.exports = class CustomDiscordWebhookTransport extends DiscordWebhookTransport {
  log(info, callback) {
    if (info.postToDiscord == false) return callback();
    this.postToWebhook(info);
    return callback();
  }
};
