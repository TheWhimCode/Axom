import {
  Client,
  GatewayIntentBits,
  ActivityType,
  Events,
  Partials,
} from "discord.js";

import { startSessionListener } from "./src/listener/sessionPaid";
import { startSessionRescheduledListener } from "./src/listener/sessionRescheduled";
import { startTimeCheckCron } from "./src/cron/timeCheck";
import { registerDMListener } from "./src/listener/receivedDM";
import { startTwitchLiveChecker } from "./src/services/notifiers/Twitch";
import { startOwnerWellbeingCron } from "./src/cron/selfcare";
import { startOwnerMorningScheduleCron } from "./src/cron/sessionsToday";

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

  // Your self-care DMs
  startOwnerWellbeingCron(client);

  // Your 8am daily schedule summary
  startOwnerMorningScheduleCron(client);
});

client.login(DISCORD_TOKEN);