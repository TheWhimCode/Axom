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
import { handlePendingDMOnJoin } from "./src/services/coaching-related/joinServerHold";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const PATREON_CHANNEL_ID = process.env.PATREON_CHANNEL_ID!;
const DIRECT_DATABASE_URL = process.env.DIRECT_DATABASE_URL!;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// --- Ready: start listeners ---
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}`);

  // only keep this one useful log
  console.log("Connected to DB:", DIRECT_DATABASE_URL);

  client.user?.setPresence({
    activities: [{ name: "I AM A BUTTERFLY", type: ActivityType.Watching }],
    status: "online",
  });

  startSessionListener();
  startPatreonPgListener(client);

  client.on("guildMemberAdd", handlePendingDMOnJoin);

  sessionEvents.on("sessionPaid", async (payload) => {
    notifyOwner(client, payload);
    notifyStudent(client, payload);
  });
});

// --- Login ---
client.login(DISCORD_TOKEN);

// Helper
export async function postToPatreonChannel(content: string) {
  const ch = await client.channels.fetch(PATREON_CHANNEL_ID).catch(() => null);
  if (ch && ch.isTextBased()) {
    await (ch as TextChannel).send({ content });
  }
}
