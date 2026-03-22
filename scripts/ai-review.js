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
- Issues that can break production, cause incorrect emission values, crashes, or security risks

WARNING:
- Risky patterns, missing validations, unclear logic, or maintainability concerns

SUGGESTIONS:
- Improvements that enhance clarity, robustness, or performance

NOTE:
- One line stating whether emission calculation logic is impacted or not

Rules:
- Limit each point to 1–2 lines maximum
- Be concise and precise
- ALWAYS include file path in each point (e.g., controllers/file.js:)
- Do not repeat code
- Do not explain obvious things
- Focus only on changed lines
- If no issues, explicitly say "No issues found"

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
    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-5.1",
    input: prompt
  })
});

const data = await res.json();
console.log(data);

const text =
  data?.output?.[0]?.content?.[0]?.text ||
  "No AI response received";

console.log("\n===== AI REVIEW =====\n");
console.log(text);

const reviewComment = `
### 🤖 AI Code Review

${text}
`;

if (process.env.GITHUB_TOKEN && process.env.PR_NUMBER) {
  await fetch(`https://api.github.com/repos/${process.env.REPO}/issues/${process.env.PR_NUMBER}/comments`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      body: reviewComment
    })
  });

  console.log("✅ Comment posted to PR");
}