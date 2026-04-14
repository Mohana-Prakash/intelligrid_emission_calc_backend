import "dotenv/config";
import fs from "fs";
import { execSync } from "child_process";

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
- Format EXACTLY:
  <file_path>:<line_number> → <issue>
- Example:
  services/file.js:45 → Missing validation
- Use actual changed line numbers (not @@ header)

IGNORE:
- scripts/*
- .github/*
- config/test/build files

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
- Line numbers must correspond to the actual changed line within the diff, not the diff chunk header (e.g., avoid using @@ -77).
- Prefer the exact line where the change occurs (e.g., added/removed/commented line).

IGNORE FILES (VERY IMPORTANT):

- Ignore any files related to tooling, CI/CD, or AI review itself
- Specifically ignore:
  - scripts/ai-review.js
  - .github/workflows/*
  - Any test, config, or build-related files

- Only review PRODUCT / BUSINESS LOGIC files such as:
  - controllers/*
  - services/*
  - models/*
  - routes/*
  - middlewares/*

- If a change belongs to ignored files, DO NOT include it in CRITICAL, WARNING, or SUGGESTIONS

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

console.log(text);

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
// function extractIssues(text, section) {
//   const regex = new RegExp(`${section}:([\\s\\S]*?)(?=\\n[A-Z]+:|$)`);
//   const match = text.match(regex);

//   if (!match) return [];

//   return match[1]
//     .trim()
//     .split("\n")
//     .map((line) => line.replace(/^-\s*/, "").trim())
//     .filter((line) => line.includes(":") && line.includes("→"))
//     .map((line) => {
//       const [left, ...msgParts] = line.split("→");
//       const [file, lineNum] = left.trim().split(":");

//       return {
//         file: file.trim(),
//         line: parseInt(lineNum),
//         message: msgParts.join("→").trim(),
//       };
//     })
//     .filter((i) => i.file && i.line && !isNaN(i.line));
// }

// INLINE COMMENTS (CRITICAL)
// const criticalIssues = extractIssues(text, "CRITICAL");

// for (const issue of criticalIssues) {
//   const correctedLine = adjustLineNumber(issue.file, issue.line, code);
//   try {
//     await fetch(
//       `https://api.github.com/repos/${process.env.REPO}/pulls/${process.env.PR_NUMBER}/comments`,
//       {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           body: `${issue.message}`,
//           commit_id: process.env.GITHUB_SHA,
//           path: issue.file,
//           line: correctedLine,
//           side: "RIGHT",
//         }),
//       },
//     );

//     console.log(`✅ Inline → ${issue.file}:${correctedLine}`);
//   } catch (err) {
//     console.log("⚠️ Inline comment failed:", err.message);
//   }
// }

// function adjustLineNumber(file, approxLine, diffContent) {
//   const lines = diffContent.split("\n");

//   let currentFile = null;
//   let currentLine = 0;

//   for (const line of lines) {
//     // Detect file
//     if (line.startsWith("+++ b/")) {
//       currentFile = line.replace("+++ b/", "").trim();
//       currentLine = 0;
//       continue;
//     }

//     // Detect hunk start
//     const match = line.match(/@@ -\d+,\d+ \+(\d+),/);
//     if (match) {
//       currentLine = parseInt(match[1]);
//       continue;
//     }

//     if (currentFile === file) {
//       if (line.startsWith("+") || line.startsWith("-")) {
//         // Try to find better match near approx line
//         if (Math.abs(currentLine - approxLine) <= 5) {
//           return currentLine;
//         }
//       }
//       currentLine++;
//     }
//   }

//   return approxLine; // fallback
// }

// - Max 3 CRITICAL issues
