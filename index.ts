// index.ts (at project root)
import { Client, GatewayIntentBits, TextChannel, ActivityType } from "discord.js";
import { startPatreonPgListener } from "./src/listener/patreon-listener";
import { startSessionListener, sessionEvents } from "./src/listener/sessionPaid";
import { notifyOwner } from "./src/services/coaching-related/bookingDM";
import { notifyStudent } from "./src/services/coaching-related/studentConfirmDM";
import { handlePendingDMOnJoin } from "./src/services/coaching-related/joinServerHold";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const PATREON_CHANNEL_ID = process.env.PATREON_CHANNEL_ID!;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

// --- Ready: start listeners ---
client.once("clientReady", () => {
  console.log(`Logged in as ${client.user?.tag}`);

  // Presence
  client.user?.setPresence({
    activities: [{ name: "You xd", type: ActivityType.Watching }],
    status: "online",
  });

  // Session listener
  startSessionListener();

  // Patreon listener
  startPatreonPgListener(client);

  // Deliver pending DM on join
  client.on("guildMemberAdd", handlePendingDMOnJoin);
});

// When session is paid
sessionEvents.on("sessionPaid", async (payload) => {
  notifyOwner(client, payload);
  notifyStudent(client, payload);
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
