const https = require("https");

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  const payload = req.body;

  if (!payload || typeof payload !== "object") {
    res.status(400).json({ ok: false, error: "Missing coaching payload." });
    return;
  }

  try {
    const advice = process.env.OPENAI_API_KEY
      ? await requestOpenAiCoach(payload)
      : localCoachAdvice(payload);
    res.status(200).json({ ok: true, advice });
  } catch (error) {
    res.status(200).json({ ok: true, advice: localCoachAdvice(payload), fallback: error.message });
  }
};

async function requestOpenAiCoach(payload) {
  const input = {
    date: payload.date,
    stats: payload.stats,
    dayPriorities: payload.dayPriorities || [],
    weekPriorities: payload.weekPriorities || [],
    logs: (payload.logs || []).slice(0, 24)
  };

  const response = await postJson("https://api.openai.com/v1/responses", {
    model: OPENAI_MODEL,
    instructions: [
      "You are a direct but kind time-management coach.",
      "Analyze the user's day log and return practical advice.",
      "Do not shame the user. Be concrete about what they should do next.",
      "Return only compact JSON with keys: summary, suggestions, nextBlock.",
      "suggestions must be an array of 3 to 4 short strings."
    ].join(" "),
    input: JSON.stringify(input)
  }, {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
  });

  const text = response.output_text || extractResponseText(response);
  return normalizeCoachAdvice(JSON.parse(text));
}

function localCoachAdvice(payload) {
  const stats = payload.stats || {};
  const logs = Array.isArray(payload.logs) ? payload.logs : [];
  const threshold = Number(payload.threshold || 3);
  const lowBlocks = logs.filter((log) => Number(log.score) < 45);
  const bestBlocks = logs.filter((log) => Number(log.score) >= 75);
  const dayPriorities = Array.isArray(payload.dayPriorities) ? payload.dayPriorities : [];
  const suggestions = [];

  if (!logs.length) {
    suggestions.push("Log the last completed hour first. Honest data beats a perfect plan.");
    suggestions.push("Pick one priority and convert it into a 25-minute next action.");
  } else if (lowBlocks.length) {
    suggestions.push(`${lowBlocks[0].time || "One block"} was the leak. Identify the trigger and remove it before the next block.`);
    suggestions.push("Put the phone away, keep one work surface open, and define a single finish line.");
  } else {
    suggestions.push("You are not losing the day badly. Plan the next hour before it starts.");
  }

  if (Number(stats.wasteHours || 0) >= threshold) {
    suggestions.push("Do a reset block now: water, clear desk, one task, timer on.");
  }
  if (bestBlocks.length) {
    suggestions.push(`Repeat the conditions from ${bestBlocks[0].time || "your best block"} because that pattern already worked.`);
  }
  if (dayPriorities.length) {
    suggestions.push(`Attach the next block to "${dayPriorities[0]}" so the priority drives the calendar.`);
  }

  return normalizeCoachAdvice({
    summary: Number(stats.utilization || 0) >= 70
      ? "Good momentum. Defend it with a precise next block."
      : "The day is still recoverable if the next hour is specific and protected.",
    suggestions,
    nextBlock: "Write the one result you want by the end of the next hour, then log whether it happened."
  });
}

function normalizeCoachAdvice(advice) {
  return {
    summary: String(advice.summary || "Here is a tighter plan for the next block.").slice(0, 220),
    suggestions: (Array.isArray(advice.suggestions) ? advice.suggestions : [])
      .map((item) => String(item).slice(0, 220))
      .filter(Boolean)
      .slice(0, 4),
    nextBlock: String(advice.nextBlock || "Pick one small task, set a timer, and log the result.").slice(0, 260)
  };
}

function extractResponseText(response) {
  const output = Array.isArray(response.output) ? response.output : [];
  return output.flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text" && content.text)
    .map((content) => content.text)
    .join("\n");
}

function postJson(url, payload, headers = {}) {
  const target = new URL(url);
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { responseBody += chunk; });
      response.on("end", () => {
        let parsed = {};
        try { parsed = JSON.parse(responseBody); } catch { parsed = {}; }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(new Error(parsed.error?.message || `HTTP ${response.statusCode}`));
        }
      });
    });

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}
