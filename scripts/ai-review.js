import "dotenv/config";
import { execSync } from "child_process";

const code = execSync("git diff", { encoding: "utf-8" });

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
    model: "gpt-4.1-mini",
    input: prompt
  })
});

const data = await res.json();


// 🔍 Debug: print full response once
console.log("FULL RESPONSE:\n", JSON.stringify(data, null, 2));

// ✅ Safe extraction
const text =
  data?.output?.[0]?.content?.[0]?.text ||
  data?.output_text ||
  "No AI response received";

console.log("\n===== AI REVIEW =====\n");
console.log(text);