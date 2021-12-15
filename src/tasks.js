const utils = require("./utils.js");
const fs = require("fs");

const FILENAME = "../data/tasks.json";
const EMOJI = "📫";
let tasks;

/*
tasks.json format

{
  <timestamp as ID>: {
    channelId: <ID>
    messageId: <ID>
    title: <string>
    description: <string>
    taskmaster: <ID>
    submissions: {
      <user ID>: {
        start: <timestamp>,
        end: <timestamp>,
        submission: <string>
      }
    }
  }
}
*/

function getFile() {
  try {
    let contents = fs.readFileSync(FILENAME);
    return JSON.parse(contents);
  } catch (e) {
    utils.logger.warn(
      `${FILENAME} doesn't exist or isn't readable. Using empty object instead.`
    );
    return {};
  }
}

function writeFile() {
  try {
    fs.writeFileSync(FILENAME, JSON.stringify(tasks));
  } catch (e) {
    utils.logger.error(`Cannot write ${FILENAME}: ${e}`);
  }
}

async function onBotStart(bot) {
  utils.logger.log("debug", `Loading tasks...`);
  tasks = getFile();

  // Cache task send messages
  if (Object.keys(tasks).length > 0) {
    for (const [id, task] of Object.entries(tasks)) {
      utils.logger.log("debug", `Caching Task ${id}`);
      try {
        await bot.channels.cache
          .get(bet.channelId)
          .messages.fetch(bet.messageId);
        utils.logger.log("debug", `Task ${id} cached.`);
      } catch (e) {
        utils.logger.error(`Failed to cache task ${id}: ${e}`);
      }
    }
  }
}

module.exports = {
  getFile,
  writeFile,
  onBotStart,
};
