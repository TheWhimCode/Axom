// index.ts (at project root)
import {
  Client,
  GatewayIntentBits,
  TextChannel,
  ActivityType,
  Events,
  Partials,
} from "discord.js";

import { startSessionListener } from "./src/listener/sessionPaid";
import { startSessionRescheduledListener } from "./src/listener/sessionRescheduled";
import { startTimeCheckCron } from "./src/cron/timeCheck";
import { registerDMListener } from "./src/listener/receivedDM";
import { startTwitchLiveChecker } from "./src/services/notifiers/Twitch";

// ✅ add this:
import { startOwnerWellbeingCron } from "./src/cron/selfcare";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}`);

  client.user?.setPresence({
    activities: [{ name: "I AM A BUTTERFLY", type: ActivityType.Watching }],
    status: "online",
  });

  startSessionListener(client);
  startSessionRescheduledListener(client);
  startTimeCheckCron(client);
  registerDMListener(client);
  startTwitchLiveChecker(client);

  // ✅ add this:
  startOwnerWellbeingCron(client);
});

client.login(DISCORD_TOKEN);