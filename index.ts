// index.ts (at project root)
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { startPatreonPgListener } from "./src/listener/patreon-listener";
import { startSessionListener, sessionEvents } from "./src/listener/sessionPaid";
import { notifyOwner } from "./src/services/coaching-related/bookingDM";
import { notifyStudent } from "./src/services/coaching-related/studentConfirmDM";
import { handlePendingDMOnJoin } from "./src/services/coaching-related/joinServerHold";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const PATREON_CHANNEL_ID = process.env.PATREON_CHANNEL_ID!;

// --- Discord client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers, // needed for guildMemberAdd
  ],
});

// --- Ready: start listeners ---
client.once("clientReady", () => {
  console.log(`Logged in as ${client.user?.tag}`);

  // DB LISTEN for sessions_paid
  startSessionListener();

  // Patreon listener
  startPatreonPgListener(client);

  // When someone joins, try to deliver any pending DM
  client.on("guildMemberAdd", handlePendingDMOnJoin);
});

// When sessions_paid happens in DB
sessionEvents.on("sessionPaid", async (payload) => {
  notifyOwner(client, payload);
  notifyStudent(client, payload);
});

// --- Login ---
client.login(DISCORD_TOKEN);

// (optional) helper
export async function postToPatreonChannel(content: string) {
  const ch = await client.channels.fetch(PATREON_CHANNEL_ID).catch(() => null);
  if (ch && ch.isTextBased()) {
    await (ch as TextChannel).send({ content });
  }
}
