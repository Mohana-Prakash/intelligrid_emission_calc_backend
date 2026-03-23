import "dotenv/config";
import fs from "fs";
import { execSync } from "child_process";

let code = "";

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
- Issues that will definitely break production, cause incorrect emission values, crashes, or security risks

WARNING:
- Possible risks, missing validations, unclear logic, or maintainability concerns

SUGGESTIONS:
- Improvements that enhance clarity, robustness, or performance

NOTE:
- One line stating whether emission calculation logic is impacted or not

STRICT VALIDATION RULES (VERY IMPORTANT):

CRITICAL must ONLY include:
- Definite runtime errors (e.g., undefined variables, crashes)
- Proven incorrect logic affecting output
- Guaranteed production breakage directly caused by this change

CRITICAL must NOT include:
- Assumptions or speculation
- “May cause issues” or “might break”
- Environment-dependent risks
- Missing context outside the diff

ADDITIONAL CONSTRAINTS:
- Do NOT raise hypothetical risks without direct evidence in the diff
- Do NOT assume prior implementation unless explicitly shown
- Only analyze the provided diff — ignore unseen codebase
- Every CRITICAL issue must be provably caused by the current change
- If unsure, downgrade to WARNING
- Limit CRITICAL issues to a maximum of 3 (only most severe)

Rules:
- Limit each point to 1–2 lines maximum
- Be concise and precise
- ALWAYS include file path in each point (e.g., controllers/file.js:)
- Do not repeat code
- Do not explain obvious things
- Focus only on changed lines
- ALWAYS include file path AND line number in each point
- Format EXACTLY as: <file_path>:<line_number> → <issue>
- Example: src/sample.service.js:45 → Missing error handling

If no issues are found, respond exactly with:

CRITICAL:
No issues found

WARNING:
No issues found

SUGGESTIONS:
No issues found

NOTE:
No impact to emission calculation logic

Domain-specific checks:
- Validate emission calculations are mathematically correct
- Avoid hardcoded emission factors unless justified
- Ensure null/undefined inputs are handled safely
- Check for potential NaN or incorrect numeric outputs

Code (git diff):
${code}
`;

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

const data = await res.json();

const text = data?.output?.[0]?.content?.[0]?.text || "No AI response received";

console.log("\n===== AI REVIEW =====\n");
console.log(text);

// ==========================
// 🔥 PARSE FUNCTION
// ==========================
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

// 🧠 Helper: Extract section safely
function formatSection(fullText, section, emoji) {
  const regex = new RegExp(`${section}:([\\s\\S]*?)(?=\\n[A-Z]+:|$)`);
  const match = fullText.match(regex);

  if (!match || !match[1].trim()) {
    return `${emoji} ✅ No issues found`;
  }

  return match[1]
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => `- ${line.replace(/^-\s*/, "")}`)
    .join("\n");
}

// 🚀 Bonus: Summary detection
const hasCritical =
  /CRITICAL:\s*-\s+/m.test(text) && !/CRITICAL:\s*No issues found/i.test(text);

const summary = hasCritical
  ? "🚨 **Critical issues found – review required before merge**"
  : "✅ **No critical issues – safe to proceed**";

// 🎨 Final formatted comment
const reviewComment = `
## 🤖 AI Code Review

${summary}

---

### 🔴 CRITICAL
> 🚨 Issues that will break production

${formatSection(text, "CRITICAL", "🔴")}

---

### 🟠 WARNING
> ⚠️ Potential risks or concerns

${formatSection(text, "WARNING", "🟠")}

---

### 🟢 SUGGESTIONS
> 💡 Improvements

${formatSection(text, "SUGGESTIONS", "🟢")}

---

### 🔵 NOTE
> 📝 Impact summary

${formatSection(text, "NOTE", "🔵")}
`;

// 📬 Post to GitHub PR
if (process.env.GITHUB_TOKEN && process.env.PR_NUMBER) {
  await fetch(
    `https://api.github.com/repos/${process.env.REPO}/issues/${process.env.PR_NUMBER}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body: reviewComment,
      }),
    },
  );

  console.log("✅ Comment posted to PR");
}

// ==========================
// 🚀 INLINE COMMENTS (CRITICAL)
// ==========================
const criticalIssues = extractIssues(text, "CRITICAL");

for (const issue of criticalIssues) {
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
          body: `🚨 AI: ${issue.message}`,
          path: issue.file,
          line: issue.line,
          side: "RIGHT",
        }),
      },
    );

    console.log(`✅ Inline comment → ${issue.file}:${issue.line}`);
  } catch (err) {
    console.log("⚠️ Inline comment failed:", err.message);
  }
}
