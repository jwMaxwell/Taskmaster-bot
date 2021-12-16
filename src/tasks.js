const utils = require("./utils.js");
const fs = require("fs");

const FILENAME = "../data/tasks.json";
const EMOJI = "📫";
const TASKS_CHANNEL_ID = "920138517391224922"; // #spam
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

/**
 * Get the contents of the tasks data file.
 * @returns {string} File Contents
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

/**
 * Write the cache to the tasks data file.
 */
function writeFile() {
  try {
    fs.writeFileSync(FILENAME, JSON.stringify(tasks));
  } catch (e) {
    utils.logger.error(`Cannot write ${FILENAME}: ${e.stack}`);
  }
}

/**
 * Reply with help text
 * @param {string} prefix Bot prefix
 * @param {Discord.Message} message Message to reply to
 */
function help(prefix, message) {
  const helptext =
    `\`${prefix}newtask [title] ; [description]\` - (DM Only) Create a new task.\n` +
    `\`${prefix}listtasks\` - List available tasks with links to respective messages.`;
  utils.reply(
    utils.createEmbed(
      `TaskMaster Help`,
      helptext,
      false,
      message.author.username,
      message.author.avatarURL()
    ),
    message
  );
}

/**
 * Create a new task: $newtask title ; description
 * @param {string} args Arguments from the command message
 * @param {Discord.Message} message Message that sent the command
 * @param {Discord.Client} bot Bot object
 * @returns null
 */
async function newTask(args, message, bot) {
  try {
    const taskParts = args.trim().split(";");
    let title, description;
    if (taskParts.length == 1) {
      title = "Untitled";
      description = taskParts[0];
    } else if (taskParts.length == 2) {
      title = taskParts[0].trim();
      description = taskParts[1].trim();
    } else {
      utils.logger.warn(
        `Bad number of parts (exp. 1 or 2, got ${taskParts.length}) for new task: ${args}`
      );
      utils.reply(
        utils.createEmbed(
          "Error Creating Task",
          `Wrong number of parts. Expected 1 or 2, got ${taskParts.length}`,
          false,
          null,
          null,
          utils.COLORS.RED
        ),
        message
      );
      return;
    }

    let task = {
      channelId: TASKS_CHANNEL_ID,
      title: title,
      description: description,
      taskmaster: message.author.id,
      submissions: {},
    };
    let taskId = Date.now();

    await utils.send(
      utils.createEmbed(
        `Task ${taskId} Now Available`,
        `Taskmaster: ${message.author}\nReact to receive task and start timer.`,
        false,
        message.author.username,
        message.author.avatarURL()
      ),
      TASKS_CHANNEL_ID,
      bot
    );

    const getLastMessage = await bot.channels.cache
      .get(TASKS_CHANNEL_ID)
      .messages.fetch({ limit: 1 });
    const lastMessage = getLastMessage.first();
    task.messageId = lastMessage.id;

    await lastMessage.react(EMOJI);
    tasks[taskId] = task;
    writeFile();

    utils.reply(
      utils.createEmbed(
        "Task Created!",
        `[View it Here](${lastMessage.url})`,
        false,
        message.author.username,
        message.author.avatarURL()
      ),
      message
    );

    utils.reply(
      utils.createEmbed(
        `${task.title}`,
        `Task ID: \`${taskId}\`\n---\n${task.description}`,
        false,
        message.author.username,
        message.author.avatarURL()
      ),
      message
    );

    utils.logger.log("debug", `Task ${taskId} successfully set up!`);
  } catch (e) {
    utils.logger.error(`Something went wrong creating a new task: ${e.stack}`);
  }
}

/**
 * List all available tasks: $listtasks
 * @param {Discord.Message} message Message to reply to
 * @param {Discord.Client} bot Discord bot object
 */
async function listTasks(message, bot) {
  let messageText = "";
  for (const [id, task] of Object.entries(tasks)) {
    const channel = await bot.channels.fetch(task.channelId);
    const message = await channel.messages.fetch(task.messageId);
    const user = await bot.users.fetch(task.taskmaster);
    messageText += `* [Task ${id}](${message.url}) from ${user}\n`;
  }
  utils.reply(
    utils.createEmbed(
      "Available Tasks",
      messageText,
      false,
      message.author.username,
      message.author.avatarURL()
    ),
    message
  );
}

/**
 * Things to do when the bot starts up.
 * @param {Discord.Client} bot Discord bot object
 */
async function onBotStart(bot) {
  utils.logger.log("debug", `Loading tasks...`);
  tasks = getFile();

  // Cache task send messages
  if (Object.keys(tasks).length > 0) {
    for (const [id, task] of Object.entries(tasks)) {
      utils.logger.log("debug", `Caching Task ${id}`);
      try {
        const channel = await bot.channels.fetch(task.channelId);
        await channel.messages.fetch(task.messageId);
        utils.logger.log("debug", `Task ${id} cached.`);
      } catch (e) {
        utils.logger.error(`Failed to cache task ${id}: ${e.stack}`);
      }
    }
  }

  utils.logger.info(`Tasks is ready.`);
}

/**
 * Process an incoming command.
 * @param {string} command Command issued
 * @param {string} args Everything else in the message
 * @param {Discord.Client} bot Bot object
 * @param {Discord.Message} message Message object issuing the command
 * @param {string} prefix bot prefix
 * @returns null
 */
function processCommand(command, args, bot, message, prefix) {
  if (command === "help") {
    help(prefix, message);
    return;
  } else if (command === "newtask" && message.channel.type === "DM") {
    newTask(args, message, bot);
    return;
  } else if (command === "listtasks") {
    listTasks(message, bot);
    return;
  }
}

/**
 * Handles reactions added/removed
 * @param {Discord.MessageReaction} reaction Message Reaction object for the reaction added/removed.
 * @param {Discord.User} user User who applied reaction/User whose reaction was removed.
 * @param {boolean} add True if reaction added, False if removed.
 * @param {Discord.Client} bot The instantiated Discord Bot object.
 */
async function processReaction(reaction, user, add, bot) {
  // We're not dealing with removals
  if (!add) return;

  // And we're only looking for the right emoji
  if (reaction.emoji.name !== EMOJI) {
    reaction.users.remove(user.id);
    return;
  }

  // Make sure this message is a task
  const matchingMessages = Object.keys(tasks).filter(
    (key) => tasks[key].messageId == reaction.message.id
  );
  if (matchingMessages.length == 1) {
    const task = tasks[matchingMessages[0]];
    const taskId = matchingMessages[0];
    utils.logger.log("debug", `Message ${reaction.message.url} is a task!`);

    // Make sure this person isn't the taskmaster
    if (user.id == task.taskmaster) {
      utils.logger.info(
        `${user.username} is the taskmaster for ${taskId}, but requested the task. Sending it as a courtesy.`
      );
      await utils.send(
        `You're the taskmaster for the following task. I'm sending it to you as a courtesy.`,
        user,
        bot
      );
      utils.send(
        utils.createEmbed(
          `${task.title}`,
          `Task ID: \`${taskId}\`\n---\n${task.description}`,
          false,
          user.username,
          user.avatarURL()
        ),
        user,
        bot
      );
      reaction.users.remove(user.id);
      return;
    }

    // Now check if this person has started the task already or not
    const matchingSubmissions = Object.keys(task.submissions).filter(
      (sub) => sub == user.id
    );
    if (matchingSubmissions.length == 0) {
      // New Person for this Task!
      utils.logger.log(
        "debug",
        `User ${user.username} is requesting ${taskId} for the first time`
      );
      try {
        const taskmaster = await bot.users.fetch(task.taskmaster);
        // const dmChannel = await bot.channels.fetch(user.dmChannel);
        utils.logger.log("debug", `${user.dmChannel}`);
        utils.send(
          utils.createEmbed(
            `${task.title}`,
            `Task ID: \`${taskId}\`\n---\n${task.description}`,
            false,
            taskmaster.username,
            taskmaster.avatarURL()
          ),
          user,
          bot
        );

        const now = Date.now();

        const submission = {
          start: now,
        };

        tasks[taskId].submissions[user.id] = submission;
        writeFile();

        utils.logger.log(
          "debug",
          `Task ${taskId} sent to ${user.username} at ${now}.`
        );
      } catch (e) {
        utils.logger.error(
          `Error processing task ${taskId} distribution for ${user.username}: ${e.stack}`
        );
      }
    } else if (matchingSubmissions.length == 1) {
      utils.logger.log(
        "debug",
        `User ${user.username} is requesting ${taskId} for a subsequent time.`
      );

      const submission = tasks[taskId].submissions[matchingSubmissions[0]];
      utils.send(
        utils.createEmbed(
          `You've started this already!`,
          `You started task \`${taskId}\` on ${new Date(
            submission.start
          ).toUTCString()}. Finish it!`,
          false,
          user.username,
          user.avatarURL(),
          utils.COLORS.RED
        ),
        user,
        bot
      );
    } else {
      utils.logger.error(
        `Got ${matchingSubmissions.length} submission for task ${taskId} and user ${user.id}`
      );
    }
  } else if (matchingMessages.length == 0) {
    utils.logger.log("debug", `Message ${reaction.message.url} is not a task.`);
  } else {
    utils.logger.error(
      `Found multiple tasks for message ${reaction.message.url}`
    );
  }
}

module.exports = {
  getFile,
  writeFile,
  onBotStart,
  processCommand,
  processReaction,
};
