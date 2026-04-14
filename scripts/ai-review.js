import "dotenv/config";
import fs from "fs";
import { execSync } from "child_process";
import { aiReviewPrompt } from "./ai-review-prompt.js";

let code = "";

// READ DIFF
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

const prompt = `${aiReviewPrompt}
Code (git diff):
${code}
`;

// CALL OPENAI
const res = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-5.1",
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

console.log("TEXT:", text);

// FORMAT COMMENT
function getSection(text, section) {
  const lines = text.split("\n");

  let capture = false;
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Start section
    if (trimmed.startsWith(section + ":")) {
      capture = true;
      continue;
    }

    // Stop at next section (more robust)
    if (capture && /^[A-Z]+\s*:/.test(trimmed)) {
      break;
    }

    // Collect lines
    if (capture && trimmed) {
      result.push(`- ${trimmed.replace(/^-\s*/, "")}`);
    }
  }

  return result.length ? result.join("\n") : "No issues found";
}

// Final formatted comment
const reviewComment = `
## 🤖 AI Code Review

### CRITICAL (Issues that will break production)

${getSection(text, "CRITICAL")}

### WARNING (Potential risks or concerns)

${getSection(text, "WARNING")}

### SUGGESTIONS (Improvements)

${getSection(text, "SUGGESTIONS")}

### NOTE (Impact summary)

${getSection(text, "NOTE")}
`;

// Post to GitHub PR
if (process.env.GITHUB_TOKEN && process.env.PR_NUMBER) {
  const ghRes = await fetch(
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

  const ghData = await ghRes.text();

  if (!ghRes.ok) {
    console.error("❌ GitHub API Error:", ghData);
    process.exit(1);
  }

  console.log("✅ Comment posted to PR");
}

// PARSE FUNCTION
function extractIssues(text, section) {
  const regex = new RegExp(`${section}:([\\s\\S]*?)(?=\\n[A-Z]+:|$)`);
  const match = text.match(regex);

  if (!match) return [];

  return match[1]
    .trim()
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter((line) => line.includes(":") && line.includes("→"))
    .map((line) => {
      const [left, ...msgParts] = line.split("→");
      const [file, lineNum] = left.trim().split(":");

      return {
        file: file.trim(),
        line: parseInt(lineNum),
        message: msgParts.join("→").trim(),
      };
    })
    .filter((i) => i.file && i.line && !isNaN(i.line));
}

// INLINE COMMENTS (CRITICAL)
const criticalIssues = extractIssues(text, "CRITICAL");

for (const issue of criticalIssues) {
  const correctedLine = adjustLineNumber(issue.file, issue.line, code);
  try {
    await fetch(
      `https://api.github.com/repos/${process.env.REPO}/pulls/${process.env.PR_NUMBER}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: `${issue.message}`,
          commit_id: process.env.GITHUB_SHA,
          path: issue.file,
          line: correctedLine,
          side: "RIGHT",
        }),
      },
    );

    console.log(`✅ Inline → ${issue.file}:${correctedLine}`);
  } catch (err) {
    console.log("⚠️ Inline comment failed:", err.message);
  }
}

function adjustLineNumber(file, approxLine, diffContent) {
  const lines = diffContent.split("\n");

  let currentFile = null;
  let currentLine = 0;

  for (const line of lines) {
    // Detect file
    if (line.startsWith("+++ b/")) {
      currentFile = line.replace("+++ b/", "").trim();
      currentLine = 0;
      continue;
    }

    // Detect hunk start
    const match = line.match(/@@ -\d+,\d+ \+(\d+),/);
    if (match) {
      currentLine = parseInt(match[1]);
      continue;
    }

    if (currentFile === file) {
      if (line.startsWith("+") || line.startsWith("-")) {
        // Try to find better match near approx line
        if (Math.abs(currentLine - approxLine) <= 5) {
          return currentLine;
        }
      }
      currentLine++;
    }
  }

  return approxLine; // fallback
}

// - Max 3 CRITICAL issues
// - Limit CRITICAL issues to a maximum of 3 (only most severe)
