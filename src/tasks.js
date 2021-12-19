const utils = require("./utils.js");
const fs = require("fs");

const FILENAME = "../data/tasks.json";
const EMOJI = "📫";
const TASKS_CHANNEL_ID = "920138517391224922"; // #spam
const SUBMISSIONS_CHANNEL_ID = "920138517391224922"; // #spam
let tasks;

/*
tasks.json format

{
  <timestamp as ID>: {
    active: bool
    channelId: <ID>
    messageId: <ID>
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
    `\`${prefix}newtask [description]\` - (DM Only) Create a new task.\n` +
    `\`${prefix}listtasks\` - List available tasks with links to respective messages.` +
    `\`${prefix}submit [id] [submission]\` - (DM Only) Submit to the given task.\n` +
    `\`${prefix}listsubs [id]\` - (DM Only) If you're taskmaster, list submissions for the given task.\n` +
    `\`${prefix}endtask [id]\` - (DM Only) If you're taskmaster, end the given task.`;
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
 * Create a new task: $newtask description
 * @param {string} args Arguments from the command message
 * @param {Discord.Message} message Message that sent the command
 * @param {Discord.Client} bot Bot object
 * @returns null
 */
async function newTask(args, message, bot) {
  try {
    const description = args.trim();
    if (!description) {
      utils.logger.warn(`Empty message for new task`);
      utils.reply(
        utils.createEmbed(
          "Error Creating Task",
          `No task description provided`,
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
      active: true,
      channelId: TASKS_CHANNEL_ID,
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
        `Task ${taskId}`,
        `${task.description}`,
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
  const activeTasks = Object.keys(tasks).filter((id) => tasks[id].active);
  for (const id of activeTasks) {
    const task = tasks[id];
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
 * Submit to a task.
 * @param {string} args Args from the message
 * @param {Discord.Message} message Message sent
 * @param {Discord.Client} bot Bot object
 * @returns null
 */
async function submitTask(args, message, bot) {
  let id, submissionText;
  try {
    let rest;
    [id, ...rest] = args.trim().split(" ");
    submissionText = rest.join(" ");
  } catch (e) {
    utils.logger.info(`User ${message.author.username} sent a bad submission.`);
    utils.reply(
      utils.createEmbed(
        `Bad Submission`,
        `That didn't quite work. Check your syntax and try again.`,
        false,
        message.author.username,
        message.author.avatarURL(),
        utils.COLORS.RED
      ),
      message
    );
    return;
  }

  // Now check that the task ID sent is good
  if (!Object.keys(tasks).includes(id)) {
    utils.logger.info(
      `User ${message.author.username} sent a bad task ID: ${id}`
    );
    utils.reply(
      utils.createEmbed(
        `Bad Submission`,
        `That task ID doesn't exist. Check your syntax and try again.`,
        false,
        message.author.username,
        message.author.avatarURL(),
        utils.COLORS.RED
      ),
      message
    );
    return;
  }

  // Make sure it's active
  if (!tasks[id].active) {
    utils.logger.info(
      `User ${message.author.username} tried to submit to inactive task ${id}`
    );
    utils.reply(
      utils.createEmbed(
        `Bad Submission`,
        `That task has ended.`,
        false,
        message.author.username,
        message.author.avatarURL(),
        utils.COLORS.RED
      ),
      message
    );
    return;
  }

  // Check if they're the taskmaster
  if (message.author.id == tasks[id].taskmaster) {
    utils.logger.info(
      `User ${message.author.username} tried to submit for their own task ${id}`
    );
    utils.reply(
      utils.createEmbed(
        `Bad Submission`,
        `This is your task! You can't submit to it.`,
        false,
        message.author.username,
        message.author.avatarURL(),
        utils.COLORS.RED
      ),
      message
    );
    return;
  }

  // Now make sure that they started the task
  if (!Object.keys(tasks[id].submissions).includes(message.author.id)) {
    utils.logger.info(
      `User ${message.author.username} tried to submit for task ${id} but they haven't gotten it yet.`
    );
    utils.reply(
      utils.createEmbed(
        `Bad Submission`,
        `You haven't gotten that task yet! Go react to it to start!`,
        false,
        message.author.username,
        message.author.avatarURL(),
        utils.COLORS.RED
      ),
      message
    );
    return;
  }

  // Check if they didn't already submit
  if (tasks[id].submissions[message.author.id].end ?? false) {
    utils.logger.info(
      `User ${message.author.username} tried to submit for task ${id} but they already did!`
    );
    let date = new Date(0);
    date.setUTCMilliseconds(tasks[id].submissions[message.author.id].end);
    utils.reply(
      utils.createEmbed(
        `Already Submitted`,
        `You submitted to this task on ${date.toUTCString()}`,
        false,
        message.author.username,
        message.author.avatarURL(),
        utils.COLORS.RED
      ),
      message
    );
    return;
  }

  // Ok, now we can submit the task

  const now = Date.now();
  tasks[id].submissions[message.author.id].end = now;
  tasks[id].submissions[message.author.id].submission = submissionText;
  writeFile();

  utils.logger.log(
    "debug",
    `${message.author.username} successfully submitted to task ${id}`
  );
  let date = new Date(0);
  date.setUTCMilliseconds(now);
  utils.reply(
    utils.createEmbed(
      `Submission Successful`,
      `Your submission for task \`${id}\` was received on ${date.toUTCString()}. A copy of the submission text is below.\n---\n${submissionText}`,
      false,
      message.author.username,
      message.author.avatarURL()
    ),
    message
  );
  const taskmaster = await bot.users.fetch(tasks[id].taskmaster);
  const sub = tasks[id].submissions[message.author.id];
  let start = new Date(0);
  start.setUTCMilliseconds(sub.start);
  let end = new Date(0);
  end.setUTCMilliseconds(sub.end);
  utils.send(
    utils.createEmbed(
      `New Submission for Task ${id}`,
      `Start: ${start.toUTCString()}\nEnd: ${end.toUTCString()}\n---\n${
        sub.submission
      }`,
      false,
      message.author.username,
      message.author.avatarURL()
    ),
    taskmaster,
    bot
  );
}

/**
 * Get the submissions for a task you're taskmaster on.
 * @param {string} args Args from message
 * @param {Discord.Message} message Message sent
 * @param {Discord.Client} bot Bot object
 * @returns null
 */
async function listSubmissions(args, message, bot) {
  args = args.trim();

  // Make sure the task exists
  if (!Object.keys(tasks).includes(args)) {
    utils.logger.info(
      `User ${message.author.username} tried to list subs from a bad task ID: ${id}`
    );
    utils.reply(
      utils.createEmbed(
        `Bad Task`,
        `That task ID doesn't exist. Check your syntax and try again.`,
        false,
        message.author.username,
        message.author.avatarURL(),
        utils.COLORS.RED
      ),
      message
    );
    return;
  }

  // Make sure they're the taskmaster
  if (tasks[args].taskmaster != message.author.id) {
    utils.logger.info(
      `User ${message.author.username} tried to list tasks for ${args} but they're not the taskmaster.`
    );
    utils.reply(
      utils.createEmbed(
        `Bad Task`,
        `You're not the taskmaster for that one. Nice try.`,
        false,
        message.author.username,
        message.author.avatarURL(),
        utils.COLORS.RED
      ),
      message
    );
    return;
  }

  // List the submissions
  const subs = tasks[args].submissions;
  const finishedSubIds = Object.keys(subs).filter(
    (sub) => subs[sub].end ?? false
  );
  if (finishedSubIds.length == 0) {
    utils.logger.log("debug", `No submissions for task ${args}.`);
    utils.reply(
      utils.createEmbed(
        `No Submissions`,
        `There's no submissions for ${args} yet.`,
        false,
        message.author.username,
        message.author.avatarURL()
      ),
      message
    );
    return;
  }

  for (const userId of finishedSubIds) {
    try {
      const sub = subs[userId];
      const user = await bot.users.fetch(userId);
      let start = new Date(0);
      start.setUTCMilliseconds(sub.start);
      let end = new Date(0);
      end.setUTCMilliseconds(sub.end);
      utils.reply(
        utils.createEmbed(
          `Task ${args}`,
          `Start: ${start.toUTCString()}\nEnd: ${end.toUTCString()}\n---\n${
            sub.submission
          }`,
          false,
          user.username,
          user.avatarURL()
        ),
        message
      );
    } catch (e) {
      utils.logger.error(
        `Error processing submission from ${userId} on task ${args}: ${e.stack}`
      );
    }
  }
}

async function endTask(args, message, bot) {
  args = args.trim();

  // Make sure the task exists
  if (!Object.keys(tasks).includes(args)) {
    utils.logger.info(
      `User ${message.author.username} tried to end a bad task ID: ${id}`
    );
    utils.reply(
      utils.createEmbed(
        `Bad Task`,
        `That task ID doesn't exist. Check your syntax and try again.`,
        false,
        message.author.username,
        message.author.avatarURL(),
        utils.COLORS.RED
      ),
      message
    );
    return;
  }

  // Make sure they're the taskmaster
  if (tasks[args].taskmaster != message.author.id) {
    utils.logger.info(
      `User ${message.author.username} tried end ${args} but they're not the taskmaster.`
    );
    utils.reply(
      utils.createEmbed(
        `Bad Task`,
        `You're not the taskmaster for that one. Nice try.`,
        false,
        message.author.username,
        message.author.avatarURL(),
        utils.COLORS.RED
      ),
      message
    );
    return;
  }

  // Make sure it isn't already ended
  if (tasks[args].active) {
    utils.logger.info(
      `User ${message.author.username} tried to end inactive task ${id}`
    );
    utils.reply(
      utils.createEmbed(
        `Already Ended`,
        `That task has already ended.`,
        false,
        message.author.username,
        message.author.avatarURL(),
        utils.COLORS.RED
      ),
      message
    );
    return;
  }

  // End the task
  tasks[args].active = false;
  writeFile();
  const channel = await bot.channels.fetch(tasks[args].channelId);
  const taskMessage = await channel.messages.fetch(tasks[args].messageId);
  await taskMessage.edit({ content: "This task has ended." });

  // List the submissions
  const subs = tasks[args].submissions;
  const finishedSubIds = Object.keys(subs).filter(
    (sub) => subs[sub].end ?? false
  );
  if (finishedSubIds.length == 0) {
    utils.logger.log("debug", `No submissions for task ${args}.`);
    utils.send(
      utils.createEmbed(
        `No Submissions for Task ${args}`,
        `There's no submissions for ${args}.`,
        false,
        message.author.username,
        message.author.avatarURL()
      ),
      SUBMISSIONS_CHANNEL_ID,
      bot
    );
    return;
  }

  for (const userId of finishedSubIds) {
    try {
      const sub = subs[userId];
      const user = await bot.users.fetch(userId);
      let start = new Date(0);
      start.setUTCMilliseconds(sub.start);
      let end = new Date(0);
      end.setUTCMilliseconds(sub.end);
      utils.send(
        utils.createEmbed(
          `Task ${args}`,
          `Start: ${start.toUTCString()}\nEnd: ${end.toUTCString()}\n---\n${
            sub.submission
          }`,
          false,
          user.username,
          user.avatarURL()
        ),
        SUBMISSIONS_CHANNEL_ID,
        bot
      );
    } catch (e) {
      utils.logger.error(
        `Error processing submission from ${userId} on task ${args}: ${e.stack}`
      );
    }
  }

  utils.reply(
    utils.createEmbed(
      `Task ${args} Ended Successfully`,
      `Submissions have been sent to the submissions channel.`,
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
  } else if (command === "submit" && message.channel.type === "DM") {
    submitTask(args, message, bot);
    return;
  } else if (command === "listsubs" && message.channel.type === "DM") {
    listSubmissions(args, message, bot);
    return;
  } else if (command === "endtask" && message.channel.type === "DM") {
    endTask(args, message, bot);
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

    // Make sure this is active
    if (!task.active) {
      utils.logger.info(
        `User ${user.username} tried to request inactive task ${id}`
      );
      utils.send(
        utils.createEmbed(
          `Task ${id} has ended.`,
          `Pick another one.`,
          false,
          user.username,
          user.avatarURL(),
          utils.COLORS.RED
        ),
        user
      );
      return;
    }

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
          `Task ${taskId}`,
          `${task.description}`,
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
        utils.send(
          utils.createEmbed(
            `Task ${taskId}`,
            `${task.description}`,
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
      let date = new Date(0);
      date.setUTCMilliseconds(submission.start);
      utils.send(
        utils.createEmbed(
          `You've ${submission.end ? "finished" : "started"} this already!`,
          `You started task \`${taskId}\` on ${date.toUTCString()}. ${
            submission.end ? "You've submitted it already, too." : "Finish it!"
          }`,
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
