import "dotenv/config";
import fs from "fs";
import { execSync } from "child_process";

let code = "";

// ==========================
// 📄 READ DIFF
// ==========================
if (fs.existsSync("diff.txt")) {
  console.log("📄 Reading diff from file (GitHub Actions)");
  code = fs.readFileSync("diff.txt", "utf-8");
} else {
  console.log("💻 Running local git diff");
  code = execSync("git diff", { encoding: "utf-8" });
}

if (!code || code.trim().length === 0) {
  console.log("No code changes provided for review.");
  process.exit(0);
}

// 🔥 Limit diff size
if (code.length > 12000) {
  console.log("⚠️ Diff too large, truncating...");
  code = code.slice(0, 12000);
}

// 🔐 API key guard
if (!process.env.OPENAI_API_KEY) {
  console.log("⚠️ OPENAI_API_KEY missing. Skipping AI review.");
  process.exit(0);
}

// ==========================
// 🧠 PROMPT
// ==========================
const prompt = `
You are a senior backend reviewer.

Assume the existing codebase is production-grade.
Focus ONLY on issues introduced by the changes.
Do NOT suggest refactoring or rewriting untouched code.

Project: Node.js DEFRA emission calculator

Your responsibilities:
- Prevent production bugs
- Ensure correctness of emission calculations
- Validate input and edge cases
- Maintain clean architecture boundaries

Review the given git diff and respond STRICTLY in this format:

CRITICAL:
- Issues that will definitely break production

WARNING:
- Possible risks or concerns

SUGGESTIONS:
- Improvements

NOTE:
- One line summary

STRICT RULES:
- ONLY analyze changed lines
- NO assumptions
- If unsure → WARNING
- Max 3 CRITICAL issues
- Format EXACTLY:
  <file_path>:<line_number> → <issue>
- Example:
  services/file.js:45 → Missing validation
- Use actual changed line numbers (not @@ header)

IGNORE:
- scripts/*
- .github/*
- config/test/build files

Code:
${code}
`;

// ==========================
// 🤖 CALL OPENAI
// ==========================
const res = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4.1-mini",
    input: prompt,
  }),
});

// ❌ API error handling
if (!res.ok) {
  const err = await res.text();
  console.error("❌ OpenAI API Error:", err);
  process.exit(1);
}

const data = await res.json();

const text = data?.output?.[0]?.content?.[0]?.text || "No AI response received";

console.log("\n===== AI REVIEW =====\n");
console.log(text);

// ==========================
// 🔍 PARSE ISSUES
// ==========================
function extractIssues(text, section) {
  const regex = new RegExp(`^${section}:([\\s\\S]*?)(?=^\\w+:|$)`, "m");
  const match = text.match(regex);

  if (!match) return [];

  return match[1]
    .trim()
    .split("\n")
    .map((l) => l.replace(/^-\s*/, "").trim())
    .filter((l) => l.includes(":") && l.includes("→"))
    .map((line) => {
      const [left, ...msg] = line.split("→");
      const [file, lineNum] = left.trim().split(":");

      return {
        file: file.trim(),
        line: parseInt(lineNum),
        message: msg.join("→").trim(),
      };
    })
    .filter((i) => i.file && i.line && !isNaN(i.line));
}

// ==========================
// 🚫 IGNORE FILE FILTER
// ==========================
const IGNORED_PATHS = ["scripts/", ".github/"];

function isIgnored(file) {
  return IGNORED_PATHS.some((p) => file.startsWith(p));
}

// ==========================
// 📊 SUMMARY DETECTION
// ==========================
const hasCritical = /CRITICAL:\s*\n(?!\s*No issues found)/i.test(text);

const summary = hasCritical
  ? "🚨 **Critical issues found – review required**"
  : "✅ **No critical issues – safe to proceed**";

// ==========================
// 🧾 FORMAT COMMENT
// ==========================
function formatSection(fullText, section) {
  const regex = new RegExp(`^${section}:([\\s\\S]*?)(?=^\\w+:|$)`, "m");
  const match = fullText.match(regex);

  if (!match || !match[1].trim()) {
    return "No issues found";
  }

  return match[1]
    .trim()
    .split("\n")
    .map((l) => `- ${l.replace(/^-\s*/, "")}`)
    .join("\n");
}

const reviewComment = `
## 🤖 AI Code Review

${summary}

### 🔴 CRITICAL
${formatSection(text, "CRITICAL")}

### 🟠 WARNING
${formatSection(text, "WARNING")}

### 🟢 SUGGESTIONS
${formatSection(text, "SUGGESTIONS")}

### 🔵 NOTE
${formatSection(text, "NOTE")}
`;

// ==========================
// 📬 POST SUMMARY COMMENT
// ==========================
if (process.env.GITHUB_TOKEN && process.env.PR_NUMBER) {
  await fetch(
    `https://api.github.com/repos/${process.env.REPO}/issues/${process.env.PR_NUMBER}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: reviewComment }),
    },
  );

  console.log("✅ Summary comment posted");
}

// ==========================
// 📌 INLINE COMMENTS (CRITICAL)
// ==========================
const criticalIssues = extractIssues(text, "CRITICAL");

for (const issue of criticalIssues) {
  if (!issue.line || issue.line <= 0) continue;
  if (isIgnored(issue.file)) continue;

  const correctedLine = adjustLineNumber(issue.file, issue.line, code);

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${process.env.REPO}/pulls/${process.env.PR_NUMBER}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: `🚨 AI: ${issue.message}`,
          commit_id: process.env.GITHUB_SHA,
          path: issue.file,
          line: correctedLine,
          side: "RIGHT",
        }),
      },
    );

    if (!ghRes.ok) {
      const err = await ghRes.text();
      console.log("❌ Inline comment error:", err);
    } else {
      console.log(`✅ Inline → ${issue.file}:${correctedLine}`);
    }
  } catch (err) {
    console.log("⚠️ Inline failed:", err.message);
  }
}

// ==========================
// 🧠 LINE CORRECTION
// ==========================
function adjustLineNumber(file, approxLine, diffContent) {
  const lines = diffContent.split("\n");

  let currentFile = null;
  let currentLine = 0;

  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.replace("+++ b/", "").trim();
      currentLine = 0;
      continue;
    }

    const match = line.match(/@@ -\d+,\d+ \+(\d+),/);
    if (match) {
      currentLine = parseInt(match[1]);
      continue;
    }

    if (currentFile === file) {
      if (line.startsWith("+") || line.startsWith("-")) {
        if (Math.abs(currentLine - approxLine) <= 5) {
          return currentLine;
        }
      }
      currentLine++;
    }
  }

  return approxLine;
}
