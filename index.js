require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const cron = require('node-cron');

const web = new WebClient(process.env.SLACK_BOT_TOKEN);

const ESCALATION_GROUP_ID = "S0AFAECBEVA";

const CHANNEL_IDS = [
  "C0AFAG3DVGC",
];

const REPORT_CHANNEL = "C0AFAEF1HU4";

function isUnresolved(message) {
  const resolvedWords = ["resolved", "closed", "done", "completed"];

  if (resolvedWords.some(word =>
    message.text?.toLowerCase().includes(word)
  )) return false;

  if (message.reactions) {
    const check = message.reactions.find(r => r.name === "white_check_mark");
    if (check) return false;
  }

  return true;
}

async function fetchUnresolved() {
  let all = [];

  for (let channel of CHANNEL_IDS) {
    const history = await web.conversations.history({
      channel: channel,
      limit: 300
    });

    for (let msg of history.messages) {
      if (!msg.text) continue;

      if (msg.text.includes(`<!subteam^${ESCALATION_GROUP_ID}>`)) {
        if (isUnresolved(msg)) {
          all.push({
            channel: channel,
            ts: msg.ts
          });
        }
      }
    }
  }

  return all;
}

async function sendReport() {
  const unresolved = await fetchUnresolved();

  if (unresolved.length === 0) {
    await web.chat.postMessage({
      channel: REPORT_CHANNEL,
      text: "✅ No unresolved escalations."
    });
    return;
  }

  let message = "🚨 *Daily Escalation Report*\n\n";

  unresolved.forEach((item, index) => {
    const link = `https://slack.com/archives/${item.channel}/p${item.ts.replace('.', '')}`;
    message += `${index + 1}. <${link}|View Escalation>\n`;
  });

  message += `\nTotal Pending: ${unresolved.length}`;

  await web.chat.postMessage({
    channel: REPORT_CHANNEL,
    text: message
  });
}

// 9 AM IST = 3:30 AM UTC
cron.schedule('30 3 * * *', () => {
  sendReport();
});

console.log("Escalation bot running...");
