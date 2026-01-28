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

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent, // Needed for user DMs
  ],
  partials: [Partials.Channel],
});

// --- Ready: start listeners ---
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}`);

  client.user?.setPresence({
    activities: [{ name: "I AM A BUTTERFLY", type: ActivityType.Watching }],
    status: "online",
  });

  // Start listeners
  startSessionListener(client);            // sessions_paid → DMs + DB updates
  startSessionRescheduledListener(client); // sessions_rescheduled → DMs
  startTimeCheckCron(client);
  registerDMListener(client);

  // Twitch Live Checker
  startTwitchLiveChecker(client);

  // ❌ Removed:
  // startPatreonPgListener
  // Patreon channel helpers
  // guildMemberAdd logic
});

// --- Login ---
client.login(DISCORD_TOKEN);
