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
import { startSessionListener, sessionEvents } from "./src/listener/sessionPaid";
import { notifyOwner } from "./src/services/coaching-related/bookingDM";
import { notifyStudent } from "./src/services/coaching-related/studentConfirmDM";
import { startTimeCheckCron } from "./src/cron/timeCheck";
import { storePendingDM, handlePendingDMOnJoin } from "./src/services/coaching-related/storeConfirmation";
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
  console.log("Connected to DB:", DIRECT_DATABASE_URL);

  client.user?.setPresence({
    activities: [{ name: "I AM A BUTTERFLY", type: ActivityType.Watching }],
    status: "online",
  });

  // Start listeners
  startSessionListener();
  startPatreonPgListener(client);
  startTimeCheckCron(client);
  registerDMListener(client);

  // ★ NEW — Start Twitch Live Checker
  startTwitchLiveChecker(client);

  // For queued DM sends
  client.on("guildMemberAdd", handlePendingDMOnJoin);

  // Handle sessionPaid event
  sessionEvents.on("sessionPaid", async (payload) => {
    notifyOwner(client, payload);

    const success = await notifyStudent(client, payload);

    if (!success && payload.discordId) {
      await storePendingDM(
        payload.discordId,
        `Session booked: ${payload.sessionType} @ ${payload.scheduledStart}`
      );
    }
  });
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
