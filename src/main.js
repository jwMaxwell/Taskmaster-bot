/**
 * @author Joshua Maxwell
 * @author Brandon Ingli
 * This file will start the bot.
 */

// dependencies
require("dotenv").config({
  path: process.argv.includes("--testing") ? "./.env.testing" : "./.env",
});
const { Client, Intents } = require("discord.js");
const winston = require("winston");
const winstonDiscord = require("./CustomDiscordWebhookTransport.js");
const winstonRotateFile = require("winston-daily-rotate-file");
const utils = require("./utils.js");

const PREFIX = "$";

// Logger setup
const webhookRegex = new RegExp(
  /^https:\/\/discord.com\/api\/webhooks\/(.+)\/(.+)$/,
  "g"
);
const webhookParts = webhookRegex.exec(process.env.WINSTON_DISCORD_WEBHOOK);
if (!webhookParts) {
  throw "Bad Discord Webhook";
}

const consoleLogLevel = process.env.CONSOLE_LOG_LEVEL ?? "warn";

utils.logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: consoleLogLevel,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss",
        }),
        winston.format.printf(
          (info) => `[${info.timestamp}] [${info.level}] ${info.message}`
        )
      ),
      handleExceptions: true,
    }),
    new winstonDiscord({
      id: webhookParts[1],
      token: webhookParts[2],
      level: "warn",
      format: winston.format.combine(
        winston.format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss",
        }),
        winston.format.printf(
          (info) => `[${info.timestamp}] [${info.level}] ${info.message}`
        )
      ),
      handleExceptions: true,
    }),
    new winstonRotateFile({
      filename: "combined-%DATE%.log",
      datePattern: "YYYY-MM",
      zippedArchive: false,
      maxSize: "20m",
      maxFiles: "3",
      createSymlink: true,
      symlinkName: "combined.log",
      auditFile: "combined-audit.json",
      level: "info",
      handleExceptions: true,
      format: winston.format.combine(
        winston.format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss",
        }),
        winston.format.printf(
          (info) => `[${info.timestamp}] [${info.level}] ${info.message}`
        )
      ),
    }),
    new winstonRotateFile({
      filename: "error-%DATE%.log",
      datePattern: "YYYY-MM",
      zippedArchive: false,
      maxSize: "20m",
      maxFiles: "3",
      createSymlink: true,
      symlinkName: "error.log",
      auditFile: "error-audit.json",
      level: "warn",
      handleExceptions: true,
      format: winston.format.combine(
        winston.format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss",
        }),
        winston.format.printf(
          (info) => `[${info.timestamp}] [${info.level}] ${info.message}`
        )
      ),
    }),
  ],
});

// starting the bot
const bot = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
  ],
  partials: ["CHANNEL"],
});

bot.on("ready", async () => {
  // when loaded (ready event)
  bot.user.setActivity(`${PREFIX}help | ${PREFIX}info`, { type: "PLAYING" });
  utils.logger.log("debug", `${bot.user.username} is ready...`);
});

// on message recieved
bot.on("messageCreate", async (message) => {
  if (message.partial) {
    message = await message.fetch();
  }

  if (message.channel.type === "DM" && message.author.id != bot.user.id) {
    //TODO
    utils.reply("Hello!", message);
    return;
  }

  // if it is a command
  if (message.content.charAt(0) === PREFIX) {
    //TODO
    utils.reply("Hello!", message);
    return;
  }
});

bot.on("messageReactionAdd", async (reaction, user) => {
  // When a reaction is received, check if the structure is partial
  if (reaction.partial) {
    // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
    try {
      await reaction.fetch();
    } catch (error) {
      utils.logger.error(
        `Something went wrong when fetching the message: ${error}`
      );
      // Return as `reaction.message.author` may be undefined/null
      return;
    }
  }

  //TODO
});

bot.on("messageReactionRemove", async (reaction, user) => {
  // When a reaction is received, check if the structure is partial
  if (reaction.partial) {
    // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
    try {
      await reaction.fetch();
    } catch (error) {
      utils.logger.error(
        `Something went wrong when fetching the message: ${error}`
      );
      // Return as `reaction.message.author` may be undefined/null
      return;
    }
  }

  //TODO
});

// brings the bot online
bot.login(process.env.DISJS_BOT_TOKEN);
