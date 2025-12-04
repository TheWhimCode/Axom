import fetch from "node-fetch";
import {
  Client,
  TextChannel,
  GuildChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

// ---------------------------------------------
// Types
// ---------------------------------------------
interface TwitchStreamResponse {
  data: Array<{
    title: string;
    thumbnail_url: string;
  }>;
}

let twitchAccessToken: string | null = null;
let lastLiveState = false;

// ---------------------------------------------
// 1) Get Twitch API Access Token
// ---------------------------------------------
async function getTwitchToken() {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  });

  const data = (await res.json()) as { access_token?: string };

  if (!data.access_token) {
    console.error("[Twitch] Failed to get token:", data);
    return;
  }

  twitchAccessToken = data.access_token;
  console.log("[Twitch] Token refreshed");
}

// ---------------------------------------------
// 2) Check if streamer is live
// ---------------------------------------------
async function checkLive(client: Client) {
  if (!twitchAccessToken) {
    await getTwitchToken();
    if (!twitchAccessToken) return;
  }

  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${process.env.TWITCH_STREAMER}`,
    {
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID!,
        Authorization: `Bearer ${twitchAccessToken}`,
      },
    }
  );

  if (res.status === 401) {
    console.log("[Twitch] Token expired → refreshing");
    await getTwitchToken();
    return;
  }

  const data = (await res.json()) as TwitchStreamResponse;
  const isLive = data.data && data.data.length > 0;

  if (isLive && !lastLiveState) {
    lastLiveState = true;

    const stream = data.data[0];
    if (!stream) return;

    await handleLiveEvent(client, stream.title, stream.thumbnail_url);
  }

  if (!isLive && lastLiveState) {
    lastLiveState = false;

    await handleOfflineEvent(client);
  }
}

// ---------------------------------------------
// LIVE EVENT LOGIC
// ---------------------------------------------
async function handleLiveEvent(client: Client, title: string, thumbnail: string) {
  const channelId = process.env.DISCORD_LIVE_CHANNEL_ID!;
  const channel = await client.channels.fetch(channelId);
  if (!channel) return;

  const guildChannel = channel as GuildChannel;
  const everyone = guildChannel.guild.roles.everyone;

  // 1) Rename channel
  await safeAction(() => guildChannel.setName("🟣 currently-live"));

  // 2) Make channel PUBLIC
  await safeAction(() =>
    guildChannel.permissionOverwrites.edit(everyone.id, { ViewChannel: true })
  );

  // ---------------------------------------------
  // 🔥 3) WAIT for Twitch thumbnail to generate
  // ---------------------------------------------

const finalThumb =
  thumbnail.replace("{width}", "1280").replace("{height}", "720") +
  `?t=${Date.now()}`;


  // ---------------------------------------------
  // 4) Send embed + button
  // ---------------------------------------------
  if (guildChannel.isTextBased()) {
    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Watch Now")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://twitch.tv/${process.env.TWITCH_STREAMER}`)
    );

    await safeAction(() =>
      (guildChannel as TextChannel).send({
        content: `<@&${process.env.STREAM_ROLE_ID}>`,
        embeds: [
          {
            title: "SHO IS LIVE AGAIN!! 🎉",
            description: ":star: Let's improve together!",
            color: 0x9146ff,
            thumbnail: { url: finalThumb },
          },
        ],
        components: [button],
      })
    );
  }


}

// ---------------------------------------------
// OFFLINE EVENT LOGIC
// ---------------------------------------------
async function handleOfflineEvent(client: Client) {
  const channelId = process.env.DISCORD_LIVE_CHANNEL_ID!;
  const channel = await client.channels.fetch(channelId);
  if (!channel) return;

  const guildChannel = channel as GuildChannel;
  const everyone = guildChannel.guild.roles.everyone;

  // Rename back
  await safeAction(() =>
    guildChannel.setName("stream-notifications")
  );

  // Keep private
  await safeAction(() =>
    guildChannel.permissionOverwrites.edit(everyone.id, { ViewChannel: false })
  );
}

// ---------------------------------------------
// Helper wrapper
// ---------------------------------------------
async function safeAction(action: () => Promise<any>) {
  try {
    await action();
  } catch (err) {
    console.error("[Twitch] Action failed:", err);
  }
}

// ---------------------------------------------
// Start loop
// ---------------------------------------------
export function startTwitchLiveChecker(client: Client) {
  console.log("[Twitch] Live checker started");
  checkLive(client);
  setInterval(() => checkLive(client), 60_000);
}
