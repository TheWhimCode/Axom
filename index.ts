// index.ts (at project root)
import {
  Client,
  GatewayIntentBits,
  TextChannel,
  ActivityType,
  Events,
  Partials,
} from "discord.js";

import { startPatreonPgListener } from "./src/listener/patreon-listener";
import { startSessionListener } from "./src/listener/sessionPaid";
import { startTimeCheckCron } from "./src/cron/timeCheck";
import { registerDMListener } from "./src/listener/receivedDM";
import { startTwitchLiveChecker } from "./src/services/notifiers/Twitch";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const PATREON_CHANNEL_ID = process.env.PATREON_CHANNEL_ID!;
const DIRECT_DATABASE_URL = process.env.DIRECT_DATABASE_URL!;

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
  startSessionListener(client); // sessionPaid → DMs + DB updates
  startPatreonPgListener(client);
  startTimeCheckCron(client);
  registerDMListener(client);

  // Twitch Live Checker
  startTwitchLiveChecker(client);

  // ❌ Removed:
  // client.on("guildMemberAdd", handlePendingDMOnJoin);

  // ❌ No more sessionEvents.on("sessionPaid")
});

// --- Login ---
client.login(DISCORD_TOKEN);

// Helper function
export async function postToPatreonChannel(content: string) {
  const ch = await client.channels.fetch(PATREON_CHANNEL_ID).catch(() => null);
  if (ch && ch.isTextBased()) {
    await (ch as TextChannel).send({ content });
  }
}
