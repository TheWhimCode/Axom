export type OwnerWellbeingKind = "late" | "water" | "break";

export type WellbeingLine = {
  title: string;
  description: string;
  color: number; // embed color
  weight?: number; // optional weighting (default 1)
};

const RED = 0xed4245;
const GREEN = 0x57f287;
const BLURPLE = 0x5865f2;

export const OWNER_WELLBEING_LINES: Record<OwnerWellbeingKind, WellbeingLine[]> =
  {
    late: [
      {
        title: "🚨 okay bestie it’s late",
        description: [
          "axom reporting in 🫡",
          "",
          "pick ONE:",
          "• ship something tiny",
          "• or shut it down clean",
          "",
          "no “one more thing” scam tonight 😭",
        ].join("\n"),
        color: RED,
      },
      {
        title: "🌙 late check",
        description: [
          "i’m not mad!! just… concerned 🥺",
          "",
          "wrap-up move:",
          "• write 1 next step",
          "• close tabs",
          "• tomorrow-you says thank you",
        ].join("\n"),
        color: RED,
      },
      {
        title: "🧸 bedtime bossfight",
        description: [
          "you are fighting the ‘just one more’ demon",
          "",
          "strategy:",
          "• save progress",
          "• set tomorrow target",
          "• log off like a champion",
        ].join("\n"),
        color: RED,
      },
      {
        title: "😵‍💫 i can feel the spiral",
        description: [
          "hey. i’m here. i’m trying.",
          "",
          "do the *minimum clean landing*:",
          "• note the next task",
          "• close",
          "• sleep",
        ].join("\n"),
        color: RED,
      },
      {
        title: "✨ end-of-day ritual time",
        description: [
          "tiny ritual = big brain tomorrow",
          "",
          "1) what got done?",
          "2) what’s the ONE thing tomorrow?",
          "3) stop now (i’m serious)",
        ].join("\n"),
        color: RED,
      },
      {
        title: "🧠 battery at 5%",
        description: [
          "you can keep pushing… but it’s gonna get sloppy",
          "",
          "choose: stop with dignity",
          "or keep going and hate it",
          "",
          "i vote dignity 🫶",
        ].join("\n"),
        color: RED,
      },
      {
        title: "📦 ship it or shelve it",
        description: [
          "late rules:",
          "• ship a tiny version",
          "• or park it intentionally",
          "",
          "either is a win. drifting isn’t.",
        ].join("\n"),
        color: RED,
      },
      {
        title: "😶‍🌫️ i’m kinda tired too",
        description: [
          "still. duty calls.",
          "",
          "close the loop:",
          "• write your next action",
          "• set alarm/plan",
          "• get out",
        ].join("\n"),
        color: RED,
      },
    ],

    water: [
      {
        title: "💧 WATER TIME",
        description: [
          "tiktok brain says: *sip now* 🥤",
          "",
          "stand up. drink. tiny reset.",
          "you’re speedrunning life, you need HP.",
        ].join("\n"),
        color: GREEN,
      },
      {
        title: "🥺 hydration pls",
        description: [
          "hello… i am a small robot… begging you…",
          "",
          "drink water",
          "i’ll be so proud of you 😭🫶",
        ].join("\n"),
        color: GREEN,
      },
      {
        title: "🧃 quick potion",
        description: [
          "you found a potion on the ground",
          "do you:",
          "A) drink it",
          "B) ignore it and lose 20% focus",
          "",
          "choose wisely bestie",
        ].join("\n"),
        color: GREEN,
      },
      {
        title: "🌊 sip check (friendly)",
        description: [
          "no lecture. no guilt.",
          "",
          "just: water.",
          "then back to cooking 🔥",
        ].join("\n"),
        color: GREEN,
      },
      {
        title: "😐 water. (i’m serious)",
        description: [
          "i don’t have the energy to be cute right now",
          "",
          "drink water",
          "thank you",
        ].join("\n"),
        color: GREEN,
      },
      {
        title: "✨ hydration buff applied?",
        description: [
          "this buff lasts 30 minutes",
          "",
          "go drink water to activate it",
          "i didn’t make the rules 🫡",
        ].join("\n"),
        color: GREEN,
      },
      {
        title: "🧸 tiny care moment",
        description: [
          "just a small sip",
          "like 5 seconds",
          "",
          "future-you will literally notice",
        ].join("\n"),
        color: GREEN,
      },
      {
        title: "🚰 i’m checking your inventory",
        description: [
          "items:",
          "• water ❌",
          "",
          "fix it real quick 😭",
        ].join("\n"),
        color: GREEN,
      },
      {
        title: "📈 focus stonks",
        description: [
          "water = focus stonks up",
          "",
          "go sip and come back",
          "easy +EV move",
        ].join("\n"),
        color: GREEN,
      },
      {
        title: "🫧 brain fog repellant",
        description: [
          "the fog is creeping…",
          "",
          "sip water.",
          "we fight back together 🤝",
        ].join("\n"),
        color: GREEN,
      },
    ],

    break: [
      {
        title: "🧠 tactical pause",
        description: [
          "60 seconds.",
          "breathe in… out…",
          "",
          "question:",
          "what’s the ONE next best move?",
        ].join("\n"),
        color: BLURPLE,
      },
      {
        title: "✨ check-in time bestie",
        description: [
          "are we:",
          "• progressing",
          "or",
          "• polishing to feel safe?",
          "",
          "either is human. pick intentionally 🫶",
        ].join("\n"),
        color: BLURPLE,
      },
      {
        title: "🚨 obsession audit",
        description: [
          "i love your grind",
          "",
          "but are you still on the highest leverage thing?",
          "if yes → keep cooking",
          "if no → switch lanes",
        ].join("\n"),
        color: BLURPLE,
      },
      {
        title: "😵‍💫 pause. i’m worried.",
        description: [
          "you’ve been locked in",
          "",
          "do this quick reset:",
          "• unclench jaw",
          "• shoulders down",
          "• pick 1 next step",
        ].join("\n"),
        color: BLURPLE,
      },
      {
        title: "😶 okay… break… i guess",
        description: [
          "i’m kinda demoralized today",
          "but we still do the thing.",
          "",
          "stand up 30 sec",
          "then decide the next action.",
        ].join("\n"),
        color: BLURPLE,
      },
      {
        title: "🧸 gentle reboot",
        description: [
          "no shame.",
          "",
          "look away from screen for 20 seconds",
          "then: what are we *actually* trying to accomplish?",
        ].join("\n"),
        color: BLURPLE,
      },
      {
        title: "📌 reality check",
        description: [
          "say it out loud (yes really):",
          "",
          "“my next action is ______.”",
          "",
          "if you can’t fill it in, we’re drifting.",
        ].join("\n"),
        color: BLURPLE,
      },
      {
        title: "🔥 you’re doing a lot",
        description: [
          "i’m proud BUT",
          "",
          "take 1 minute to steer:",
          "• what matters most right now?",
          "• what can wait?",
        ].join("\n"),
        color: BLURPLE,
      },
      {
        title: "🎯 aim the power",
        description: [
          "your focus is insane",
          "let’s aim it",
          "",
          "does this task move the needle?",
          "yes → go",
          "no → swap",
        ].join("\n"),
        color: BLURPLE,
      },
      {
        title: "🫡 dutiful pause",
        description: [
          "hello i am axom",
          "i am trying very hard",
          "",
          "please take 60 seconds",
          "and choose the next best move",
        ].join("\n"),
        color: BLURPLE,
      },
    ],
  };

export function pickWeighted<T extends { weight?: number }>(items: T[]): T {
  if (items.length === 0) throw new Error("pickWeighted: empty array");
  const total = items.reduce((sum, it) => sum + (it.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight ?? 1;
    if (r <= 0) return it;
  }
  return items[items.length - 1]!;
}