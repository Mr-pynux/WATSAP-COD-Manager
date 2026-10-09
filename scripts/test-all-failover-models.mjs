import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

const env = dotenv.parse(fs.readFileSync(".env.local"));
const apiKey = env.AI_API_KEY || process.env.AI_API_KEY;

if (!apiKey) {
  console.error("❌ No AI_API_KEY found!");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const modelsToTest = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

console.log("==================================================");
console.log("🔍 TESTING LIVE GEMINI MODELS FOR HIGH-AVAILABILITY");
console.log("==================================================\n");

const results = [];

for (const modelName of modelsToTest) {
  process.stdout.write(`Testing [${modelName}]... `);
  const start = Date.now();
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const response = await model.generateContent("مرحبا أ شاف، جاوبني فـ جملة وحدة بالدارجة تؤكد أنك خدام مزيان.");
    const elapsed = Date.now() - start;
    const text = response.response.text().trim();
    console.log(`✅ OK (${elapsed}ms)`);
    console.log(`   Reply: "${text}"\n`);
    results.push({ model: modelName, status: "OK", elapsed, reply: text });
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`❌ FAILED (${elapsed}ms)`);
    console.log(`   Error: ${err.message}\n`);
    results.push({ model: modelName, status: "FAILED", elapsed, error: err.message });
  }
}

console.log("\n==================================================");
console.log("📊 FINAL SUMMARY OF MODELS:");
console.log("==================================================");
console.table(results.map(r => ({ Model: r.model, Status: r.status, Latency: `${r.elapsed}ms` })));
