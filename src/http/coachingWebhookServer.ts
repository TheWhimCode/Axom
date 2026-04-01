import http from "http";
import { createHmac, timingSafeEqual } from "crypto";
import type { Client } from "discord.js";
import { logError } from "../logger";
import {
  deliverSessionPaidNotifications,
  type WebhookSessionPaidBody,
} from "../handlers/sessionPaidFromWebhook";
import { deliverSessionRescheduledNotifications } from "../handlers/sessionRescheduledFromWebhook";

const MAX_BODY_BYTES = 512 * 1024;

function verifyHmacSha256Hex(
  rawBody: Buffer,
  secret: string,
  headerHex: string | undefined
): boolean {
  if (!headerHex || !secret) return false;
  const got = headerHex.trim().toLowerCase();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (got.length !== expected.length) return false;
  try {
    const a = Buffer.from(got, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function jsonResponse(
  res: http.ServerResponse,
  status: number,
  body: Record<string, unknown>
) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function startCoachingWebhookServer(client: Client): http.Server {
  const secret = process.env.DISCORD_BOT_WEBHOOK_SECRET!;
  const webhookUrlStr = process.env.DISCORD_BOT_WEBHOOK_URL!;
  let expectedPath: string;
  try {
    expectedPath = new URL(webhookUrlStr).pathname;
  } catch {
    throw new Error(
      "[webhook] DISCORD_BOT_WEBHOOK_URL must be a valid URL (e.g. https://host/webhook/coaching)"
    );
  }
  if (!expectedPath || expectedPath === "/") {
    throw new Error(
      "[webhook] DISCORD_BOT_WEBHOOK_URL must include a path (e.g. .../webhook/coaching)"
    );
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    const path = url.pathname;

    if (req.method === "GET" && (path === "/health" || path === "/")) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    if (req.method !== "POST" || path !== expectedPath) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }

    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        res.writeHead(413, { "Content-Type": "text/plain" });
        res.end("payload too large");
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });

    req.on("end", async () => {
      try {
        if (total > MAX_BODY_BYTES) return;

        const rawBody = Buffer.concat(chunks);
        const sig = req.headers["x-sho-signature"];
        const sigStr = Array.isArray(sig) ? sig[0] : sig;

        if (!verifyHmacSha256Hex(rawBody, secret, sigStr)) {
          jsonResponse(res, 401, { error: "invalid signature" });
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody.toString("utf8"));
        } catch {
          jsonResponse(res, 400, { error: "invalid json" });
          return;
        }

        if (typeof parsed !== "object" || parsed === null) {
          jsonResponse(res, 400, { error: "invalid body" });
          return;
        }

        const body = parsed as {
          type?: string;
          session?: WebhookSessionPaidBody;
          previousScheduledStart?: string;
        };

        const eventType = body.type;
        if (eventType !== "session_paid" && eventType !== "session_rescheduled") {
          jsonResponse(res, 400, {
            error: "expected type session_paid or session_rescheduled",
          });
          return;
        }

        const session = body.session;
        if (!session || typeof session !== "object" || !session.id) {
          jsonResponse(res, 400, { error: "missing session.id" });
          return;
        }

        if (!client.isReady()) {
          jsonResponse(res, 503, { error: "discord client not ready" });
          return;
        }

        if (eventType === "session_paid") {
          await deliverSessionPaidNotifications(client, session);
        } else {
          const prev = body.previousScheduledStart;
          if (!prev || typeof prev !== "string") {
            jsonResponse(res, 400, {
              error: "missing previousScheduledStart for session_rescheduled",
            });
            return;
          }
          await deliverSessionRescheduledNotifications(client, session, prev);
        }

        jsonResponse(res, 200, { ok: true });
      } catch (err) {
        logError("coachingWebhookServer", err);
        const msg = err instanceof Error ? err.message : "internal error";
        jsonResponse(res, 500, { error: msg });
      }
    });

    req.on("error", (err) => {
      logError("coachingWebhookServer request", err);
      res.writeHead(400);
      res.end();
    });
  });

  const port = Number(process.env.PORT ?? process.env.HTTP_PORT ?? 3000);
  server.listen(port, "0.0.0.0", () => {
    console.log(
      `[webhook] coaching events on 0.0.0.0:${port} path ${expectedPath}`
    );
  });

  return server;
}
