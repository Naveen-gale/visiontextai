require('dotenv').config();
const Groq = require("groq-sdk");

async function testGroq() {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const systemPrompt = `You are a professional presentation architect. Your task is to plan a high-quality presentation.
    - Create a coherent, engaging narrative flow with a strong opening and clear conclusion.
    - Plan exactly 8 slides.
    - IF USER PROVIDED A LIST OF SLIDES (Slide 1, Slide 2...), USE THEM EXACTLY. DO NOT summarize or skip them.
    - NO empty pages. Every user's PPT should be unique and highly accurate according to their prompt. Provide a high-level, perfectly structured GPT-like outline.
    - For each slide, determine: "type", "title", and "description".
    - Slide types: "title", "content", "image", "two-column", "quote", "timeline", "stats".
    - To ensure unique creativity, here is a random seed: ${Math.random()}. Do not generate the exact same outline as previous attempts.
    - Respond strictly with JSON: { "outline": [ ... ] }`;

    try {
        const response = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Outline a 8-slide presentation about: Artificial Intelligence` }
            ],
            response_format: { type: "json_object" },
            max_tokens: 2000,
            temperature: 0.6,
        });

        console.log("Response:", response.choices[0].message.content);
    } catch (e) {
        console.error("Groq Error:", e);
    }
}

testGroq();
