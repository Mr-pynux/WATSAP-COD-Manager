import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

const env = dotenv.parse(fs.readFileSync(".env.local"));
const apiKey = env.AI_API_KEY || process.env.AI_API_KEY;

const genAI = new GoogleGenerativeAI(apiKey);

// Create a small dummy WAV/audio base64 or test with minimal inline data
// Actually, let's test if the models accept multimodal audio part schema:
const chain = [
  "gemini-flash-lite-latest",
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.7-flash",
  "gemini-3-flash-preview",
];

console.log("Testing multimodal capability for all 5 verified models...");

for (const mName of chain) {
  try {
    const model = genAI.getGenerativeModel({ model: mName });
    // Minimal 1-second silence wav header in base64
    const wavSilenceBase64 = "UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP//";
    const res = await model.generateContent([
      {
        inlineData: {
          mimeType: "audio/wav",
          data: wavSilenceBase64,
        },
      },
      "شنو كتسمع فهاد الصوت؟ جاوب باختصار.",
    ]);
    console.log(`✅ [${mName}] Audio Multimodal Supported! Reply: "${res.response.text().trim()}"`);
  } catch (err) {
    console.log(`⚠️ [${mName}] Error: ${err.message}`);
  }
}
