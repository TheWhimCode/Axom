import {
  Client,
  GatewayIntentBits,
  ActivityType,
  Events,
  Partials,
} from "discord.js";

import { closePool } from "./src/db";
import { validateEnv } from "./src/env";
import { logError } from "./src/logger";
import { startSessionListener } from "./src/listener/sessionPaid";
import { startSessionRescheduledListener } from "./src/listener/sessionRescheduled";
import { startTimeCheckCron } from "./src/cron/timeCheck";
import { registerDMListener } from "./src/listener/receivedDM";
import { startTwitchLiveChecker } from "./src/services/notifiers/Twitch";
import { startOwnerWellbeingCron } from "./src/cron/selfcare";
import { startOwnerMorningScheduleCron } from "./src/cron/sessionsToday";

validateEnv();

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

let stopSessionPaid: (() => Promise<void>) | null = null;
let stopSessionRescheduled: (() => Promise<void>) | null = null;

let shuttingDown = false;
async function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[shutdown] Stopping…");

  client.destroy();

  await stopSessionPaid?.().catch((err) => logError("shutdown sessionPaid", err));
  await stopSessionRescheduled?.().catch((err) => logError("shutdown sessionRescheduled", err));
  await closePool().catch((err) => logError("shutdown pool", err));

  console.log("[shutdown] Done.");
  process.exit(0);
}

process.on("SIGINT", () => void gracefulShutdown());
process.on("SIGTERM", () => void gracefulShutdown());

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}`);

  client.user?.setPresence({
    activities: [{ name: "I AM A BUTTERFLY", type: ActivityType.Watching }],
    status: "online",
  });

  stopSessionPaid = startSessionListener(client);
  stopSessionRescheduled = startSessionRescheduledListener(client);
  startTimeCheckCron(client);
  registerDMListener(client);
  startTwitchLiveChecker(client);

  // Your self-care DMs
  startOwnerWellbeingCron(client);

  // Your 8am daily schedule summary
  startOwnerMorningScheduleCron(client);
});

client.login(DISCORD_TOKEN);