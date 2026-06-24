import Groq from "groq-sdk";
import fs from "fs/promises";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import AiLearning from "../models/AiLearning.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pythonScriptPath = path.join(__dirname, "../../fallback_ai.py");

// ─── Multi-Key Groq Pool ──────────────────────────────────────────────────────
// Reads GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3 ... from .env
function buildKeyPool() {
    const keys = [];
    // Always grab the primary key
    if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
    // Then grab any numbered extras
    let n = 2;
    while (process.env[`GROQ_API_KEY_${n}`]) {
        keys.push(process.env[`GROQ_API_KEY_${n}`]);
        n++;
    }
    if (keys.length === 0) throw new Error("No GROQ_API_KEY defined in .env");
    return keys;
}

let _keyPool = null;
let _currentKeyIndex = 0;

const getKeyPool = () => {
    if (!_keyPool) _keyPool = buildKeyPool();
    return _keyPool;
};

/** Get a fresh Groq client for the given key index */
const getGroqClient = (idx) => {
    const keys = getKeyPool();
    return new Groq({ apiKey: keys[idx % keys.length] });
};

/** Legacy export kept for compatibility */
export const getGroq = () => getGroqClient(_currentKeyIndex);

/**
 * Universal Groq call with automatic key rotation on 429 / rate-limit errors.
 * Tries every key in the pool before giving up.
 */
export const callAiWithFallback = async (groqParams) => {
    const pool = getKeyPool();
    const startIdx = _currentKeyIndex;

    for (let attempt = 0; attempt < pool.length; attempt++) {
        const idx = (startIdx + attempt) % pool.length;
        const client = getGroqClient(idx);
        try {
            const result = await client.chat.completions.create(groqParams);
            _currentKeyIndex = idx;
            return result;
        } catch (err) {
            const isRateLimit = err?.status === 429
                || err?.message?.includes("429")
                || err?.message?.toLowerCase().includes("rate limit")
                || err?.message?.toLowerCase().includes("rate_limit");

            if (isRateLimit) {
                if (attempt < pool.length - 1) {
                    const nextIdx = (idx + 1) % pool.length;
                    console.warn(`[Groq] Key #${idx + 1} hit rate limit. Switching to key #${nextIdx + 1}...`);
                    _currentKeyIndex = nextIdx;
                    continue; 
                } else if (groqParams.model !== "llama-3.1-8b-instant") {
                    // Exhausted all keys for the large model? Try the high-limit 8b model as a last resort.
                    console.warn(`[Groq] All keys rate limited for ${groqParams.model}. Falling back to llama-3.1-8b-instant...`);
                    return await client.chat.completions.create({
                        ...groqParams,
                        model: "llama-3.1-8b-instant"
                    });
                }
            }
            throw err;
        }
    }
};


// ─── AI TRAINING DATA (ONLINE PPT REFERENCES) ───────────────────────────────
const ONLINE_PPT_REFERENCES = `
### PRE-TRAINED ONLINE PPT REFERENCES
You have been trained on the structure of the world's most successful online presentations. When creating layouts, refer to these master frameworks:

REFERENCE 1: "The Airbnb Pitch Deck" (Startup / High-Impact Style)
- Slide 1: Title (Minimalist)
- Slide 2: Problem (3 stark, painful facts)
- Slide 3: Solution (Simple one-liner with 3 direct benefits)
- Slide 4: Market Validation (Massive numbers, clear stats)
- Slide 5: Market Size (Concentric circles or visual stats)
- Slide 6: Product (Images with short descriptive bullets)
- Slide 7: Business Model (How we make money)
- Slide 8: Adoption Strategy (Timeline/Steps)

REFERENCE 2: "The McKinsey Consulting Report" (Data-Driven / Corporate Style)
- Every slide uses an "Action Title" (a full sentence summarizing the absolute main point).
- Extensive use of 'two-column' layouts (Data on left, Insights on right).
- 'Stats' types favored over generic bullet points.
- Highly professional, objective tone. No fluff.

REFERENCE 3: "The TED Talk Keynote" (Storytelling / Narrative Style)
- Zero bullet points.
- Extremely high reliance on 'quote' and 'image' slides.
- Slide 1: The Hook (A surprising statistical fact or bold claim).
- Slide 2: The Status Quo (Image slide representing the current world).
- Slide 3..N: The Journey (Timeline format or series of full-screen quotes).
- Final Slide: The Call to Action (Powerful thought).
`;

/**
 * Helper to run the Python fallback script when Groq fails
 */
function runPythonFallback(action, data) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ action, ...data });
        
        // Spawn Python process
        const pythonProcess = spawn("python", [pythonScriptPath]);
        
        let output = "";
        let errorOutput = "";

        pythonProcess.stdout.on("data", (chunk) => { output += chunk.toString(); });
        pythonProcess.stderr.on("data", (chunk) => { errorOutput += chunk.toString(); });

        pythonProcess.on("close", (code) => {
            try {
                if (!output) throw new Error(errorOutput || "Python script returned no output");
                const parsed = JSON.parse(output);
                if (parsed.success) resolve(parsed.result);
                else reject(new Error(parsed.error || "Python fallback error"));
            } catch (err) {
                reject(new Error(`Fallback failed: ${err.message}`));
            }
        });

        // Write to stdin
        pythonProcess.stdin.write(payload);
        pythonProcess.stdin.end();
    });
}

/**
 * Extract text from an image using Groq Vision (llama-4-scout) or Python fallback
 */
export const extractTextFromImage = async (imagePath) => {
    try {
        const imageBuffer = await fs.readFile(imagePath);
        const base64Image = imageBuffer.toString("base64");

        const ext = imagePath.split(".").pop().toLowerCase();
        const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
        const mimeType = mimeMap[ext] || "image/jpeg";

        const response = await callAiWithFallback({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "You are equipped with 'Context-Aware Understanding' and 'Handwriting Style Learning'. Extract ALL text from this image exactly as it appears. You must use context to accurately interpret unclear characters or sloppy handwriting, adapting to the handwriting style intelligently to fix spelling. Return ONLY the extracted text, nothing else." },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
                    ],
                },
            ],
            max_tokens: 4096,
            temperature: 0.1,
        });

        return response.choices[0]?.message?.content || "[NO TEXT FOUND]";
    } catch (error) {
        console.warn(`Groq OCR Failed (${error.message}). Running Python fallback...`);
        try {
            return await runPythonFallback("extractText", { imagePath });
        } catch (pyError) {
            console.error("Python Fallback Error:", pyError.message);
            throw new Error(`Text extraction failed (and fallback failed): ${error.message}`);
        }
    }
};

/**
 * Summarize extracted text using Groq or Python fallback
 */
export const summarizeText = async (text) => {
    try {
        const response = await callAiWithFallback({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: "You are a professional summarizer. Create clear, concise summaries." },
                { role: "user", content: `Summarize:\n\n${text}` },
            ],
            max_tokens: 1024,
            temperature: 0.3,
        });

        return response.choices[0]?.message?.content || "Summary not available.";
    } catch (error) {
        console.warn(`Groq Summarize Failed (${error.message}). Running Python fallback...`);
        return await runPythonFallback("summarize", { text });
    }
};

/**
 * Translate text using Groq or Python fallback
 */
export const translateText = async (text, targetLanguage) => {
    try {
        const response = await callAiWithFallback({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: `Translate text accurately to ${targetLanguage}. Return ONLY the translated text.` },
                { role: "user", content: `Translate to ${targetLanguage}:\n\n${text}` },
            ],
            max_tokens: 4096,
            temperature: 0.2,
        });

        return response.choices[0]?.message?.content || text;
    } catch (error) {
        console.warn(`Groq Translate Failed (${error.message}). Running Python fallback...`);
        return await runPythonFallback("translate", { text, targetLanguage });
    }
};

/**
 * Fix grammar using Groq or Python fallback
 */
export const fixGrammar = async (text) => {
    try {
        const response = await callAiWithFallback({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: "You are a Smart Error Correction engine. Automatically fix spelling mistakes, correct grammar, and rewrite unclear sentences to make the output clean, professional, and easy to read. Return ONLY the corrected text." },
                { role: "user", content: `Clean and correct this text:\n\n${text}` },
            ],
            max_tokens: 4096,
            temperature: 0.2,
        });

        return response.choices[0]?.message?.content || text;
    } catch (error) {
        console.warn(`Groq Grammar Failed (${error.message}). Running Python fallback...`);
        return await runPythonFallback("fixGrammar", { text });
    }
};

/**
 * Extract key info using Groq or Python fallback
 */
export const extractKeyInfo = async (text) => {
    try {
        const response = await callAiWithFallback({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: "Extract and categorize key information (names, dates, numbers) from text." },
                { role: "user", content: `Extract data from:\n\n${text}` },
            ],
            max_tokens: 1024,
            temperature: 0.2,
        });

        return response.choices[0]?.message?.content || "No key information found.";
    } catch (error) {
        console.warn(`Groq Key Info Failed (${error.message}). Running Python fallback...`);
        return await runPythonFallback("extractInfo", { text });
    }
};

/**
 * Answer a question based on provided text using Groq
 */
export const askQuestion = async (text, question) => {
    try {
        const response = await callAiWithFallback({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: "You are a helpful assistant. Use the provided text to answer the user's question. Be accurate and concise. If the answer is not in the text, politely say so." },
                { role: "user", content: `Context:\n${text}\n\nQuestion: ${question}` },
            ],
            max_tokens: 1024,
            temperature: 0.4,
        });

        return response.choices[0]?.message?.content || "I couldn't find an answer to that question.";
    } catch (error) {
        console.warn(`Groq Ask Question Failed (${error.message}). Running Python fallback...`);
        return await runPythonFallback("askQuestion", { text, question });
    }
};

/**
 * Simplify concept using Groq
 */
export const simplifyConcept = async (text) => {
    try {
        const response = await callAiWithFallback({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: "You are an expert educator. Simplify the following text or concept into easy-to-understand language suitable for a student. Use analogies if helpful. Do NOT use markdown code blocks around your entire answer." },
                { role: "user", content: `Simplify this:\n\n${text}` },
            ],
            max_tokens: 1024,
            temperature: 0.4,
        });
        return response.choices[0]?.message?.content || "Could not simplify.";
    } catch (error) {
        console.warn(`Groq Simplify Failed (${error.message}). Running Python fallback...`);
        return await runPythonFallback("simplifyConcept", { text });
    }
};

/**
 * Generate Knowledge Graph (Mermaid.js) using Groq
 */
export const generateKnowledgeGraph = async (text) => {
    try {
        const response = await callAiWithFallback({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "You are a knowledge architect. Create a valid Mermaid.js mindmap diagram connecting the main ideas, entities, and concepts found in the provided text. Keep node names concise. Only output valid Mermaid syntax inside a ```mermaid ... ``` code block. Do NOT include any intro or outro text." },
                { role: "user", content: `Generate a Mermaid mindmap for this:\n\n${text}` },
            ],
            max_tokens: 1500,
            temperature: 0.2,
        });

        const raw = response.choices[0]?.message?.content || "";
        const match = raw.match(/```mermaid\n([\s\S]*?)```/);
        return match ? match[1].trim() : raw.trim();
    } catch (error) {
        console.warn(`Groq Knowledge Graph Failed (${error.message}). Running Python fallback...`);
        return await runPythonFallback("generateKnowledgeGraph", { text });
    }
};

/**
 * Real-Time Suggestion Engine using Groq
 */
export const suggestionEngine = async (text) => {
    try {
        const response = await callAiWithFallback({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: "You are a real-time study assistant. Identify 3-5 complex terms, key ideas, or interesting facts from the text and provide clear meanings, explanations, and related info for them. Format clearly using markdown bullet points or headers." },
                { role: "user", content: `Provide suggestions/explanations for:\n\n${text}` },
            ],
            max_tokens: 1024,
            temperature: 0.4,
        });

        return response.choices[0]?.message?.content || "No suggestions available.";
    } catch (error) {
        console.warn(`Groq Suggestion Engine Failed (${error.message}). Running Python fallback...`);
        return await runPythonFallback("suggestionEngine", { text });
    }
};

/**
 * Helper to fetch and format learned corrections for a session
 */
async function getLearnedContext(sessionId) {
    if (!sessionId || sessionId === "anonymous") return "";
    try {
        const corrections = await AiLearning.find({ sessionId })
            .sort({ createdAt: -1 })
            .limit(10);

        if (corrections.length === 0) return "";

        let context = "\n\n### USER STYLE ADAPTATION (Successful Examples):\n";
        context += "The user has previously refined your output. Use these examples to adapt your tone and depth to their preferred style:\n";
        
        corrections.forEach(c => {
            const type = c.input?.type || "content";
            const topic = c.input?.topic || "general";
            const corrected = c.output?.text;
            
            if (corrected) {
                context += `- Preferred ${type} format for "${topic}": "${corrected}"\n`;
            }
        });
        
        context += "\nMaintain your current high-quality, structured presentation style while incorporating these specific phrasing preferences.\n";
        return context;
    } catch (err) {
        console.warn("[Learning] Could not fetch corrections:", err.message);
        return "";
    }
}

/**
 * Generate PPT slide content using Groq AI.
 * Returns a JSON array of slide objects.
 * @param {string} prompt - User's presentation topic/request
 * @param {string|null} base64Image - Optional base64 image for visual context
 * @param {string} mimeType - MIME type of the image
 * @param {number} slideCount - Requested number of slides
 * @param {string} sessionId - For personalized learning
 * @param {string} structure - Predicted presentation structure
 */
const hasImageRequest = (text) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
        lower.includes("add image") ||
        lower.includes("add img") ||
        lower.includes("with image") ||
        lower.includes("with img") ||
        lower.includes("include image") ||
        lower.includes("include img") ||
        lower.includes("show image") ||
        lower.includes("show img") ||
        lower.includes("okay to images") ||
        (lower.includes("image") && !lower.includes("no image") && !lower.includes("without image")) ||
        (lower.includes("img") && !lower.includes("no img") && !lower.includes("without img")) ||
        lower.includes("picture") ||
        lower.includes("photo") ||
        lower.includes("illustration")
    );
};

export const generatePPTContent = async (prompt, base64Image = null, mimeType = "image/jpeg", slideCount = 8, sessionId = "anonymous", structure = null) => {
    const learningContext = await getLearnedContext(sessionId);
    const structureContext = structure ? `\nPRESENTATION STRUCTURE / FLOW: The presentation must be designed strictly following the "${structure}" narrative structure flow. The sequence and layout types of the slides must fit this theme. Make sure to return ONLY a JSON object with a "slides" array containing the slides, and no other fields.\n` : "";
    const allowImages = hasImageRequest(prompt) || !!base64Image;

    const systemPrompt = `You are an expert presentation designer. Your ENTIRE output must be driven by the user's prompt — topic, tone, and structure.

CRITICAL RULES:
1. SLIDE VARIETY: Use a mix of types that dynamically fit the structure. You MAY repeat types consecutively if the narrative demands it. Types: ${allowImages ? '"title", "content", "image", "two-column", "quote", "timeline", "stats"' : '"title", "content", "two-column", "quote", "timeline", "stats"'}.
2. Slide 1 MUST be "title". ALL other slides (except possibly a concluding slide) MUST be content-heavy types: ${allowImages ? '"content", "two-column", "timeline", "stats", or "image"' : '"content", "two-column", "timeline", "stats"'}. NEVER use "title" type for middle slides.
3. CONTENT per slide:
   - Mix longer, detailed explanations with short, punchy bullet points to ensure the user perfectly understands the PPT output. Make it high-level, perfect output like GPT.
   - "content": 3-5 punchy bullets, each 6-12 words, plus deeper details if needed.
   - "two-column": Simple comparison.
   - "stats": Use the user's data EXACTLY if provided.
   - "timeline": Logical steps (Step 1, Step 2...).
   - "quote": One powerful quote.
   - "title": ONLY Slide 1 and optionally the final slide.
4. EXACT USER STRUCTURE: If the user provides an explicit slide-by-slide outline (e.g., "Slide 1: ... Slide 2: ..."), you MUST follow their exact text and structure. Pick the slide layout ("content", "two-column", etc.) that best matches their text, but DO NOT force unrelated layouts.
5. NO EMPTY SLIDES: DO NOT generate any empty slides. EVERY single slide MUST be fully populated with detailed content.
6. ADAPT TO PROMPT: If the user does NOT provide an exact structure, drastically adapt the slide types to the topic. Avoid repetitive sequences across different topics. Make each generated PPT structurally unique.
7. SIMPLE DEFINITIONS: For complex terms, always provide a "Simple Definition: [Definition]" bullet. Emulate GPT's clear, educational, and highly structured presentation style.
8. NO FILLER: No "Key point here". Just the facts/meaning simply.
8. imageKeyword: ${allowImages ? 'ONLY generate an image keyword if the user explicitly says "okay" to images or specifically requests one. Otherwise, leave it empty ("").' : 'DO NOT generate an image keyword. Keep imageKeyword empty ("") and do not use it.'}
9. NO SELF-BRANDING: NEVER use the words "VisionText AI" or any software names.
10. RETURN FORMAT: Respond with JSON: { "slides": [ ... ] }

${learningContext}${structureContext}`;

    const userMessages = [];
    if (base64Image) {
        userMessages.push({
            role: "user",
            content: [
                { type: "text", text: `Create a ${slideCount}-slide presentation: ${prompt}` },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            ],
        });
    } else {
        userMessages.push({
            role: "user",
            content: `Create a ${slideCount}-slide presentation about: ${prompt}. Make every slide type different from adjacent slides. Keep bullet text concise (8-14 words per bullet).`,
        });
    }

    const model = base64Image
        ? "meta-llama/llama-4-scout-17b-16e-instruct"
        : "llama-3.3-70b-versatile";

    const response = await callAiWithFallback({
        model,
        messages: [
            { role: "system", content: systemPrompt },
            ...userMessages,
        ],
        max_tokens: 3000,
        temperature: 0.65,
        response_format: base64Image ? undefined : { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const jsonMatch = raw.match(/(\{\s*"slides"[\s\S]*?\}\s*\]\s*\})/m)
        || raw.match(/(\{\s*"slides"[\s\S]*\})/m)
        || raw.match(/(\[\s*\{[\s\S]*\}\s*\])/m)
        || raw.match(/```(?:json)?\s*([\s\S]*?)```/);

    const jsonStr = jsonMatch ? jsonMatch[1] : raw;

    try {
        let slides = JSON.parse(jsonStr);
        slides = Array.isArray(slides) ? slides : (slides.slides || slides.presentation || []);
        return slides.map(s => {
            if (s.imageKeyword) {
                const seed = Math.floor(Math.random() * 1000000);
                s.image = `https://image.pollinations.ai/prompt/${encodeURIComponent(s.imageKeyword)}?width=800&height=600&seed=${seed}&model=flux&nologo=true`;
            }
            return s;
        });
    } catch {
        throw new Error("AI did not return valid slide JSON. Please try again.");
    }
};

/**
 * PHASE 1: Generate a presentation outline
 */
export const generatePPTOutline = async (topic, slideCount = 8, styleGuide = null, sessionId = "anonymous", structure = null) => {
    const learningContext = await getLearnedContext(sessionId);
    const isAuto = slideCount === 0;
    const styleContext = styleGuide ? `Adhere to this design style guide: ${JSON.stringify(styleGuide)}` : "";
    const structureContext = structure ? `\nPRESENTATION STRUCTURE / FLOW: The outline must be designed strictly following the "${structure}" narrative flow structure. Ensure the sequence and logical progression of slide topics align perfectly with this structure.\n` : "";
    const allowImages = hasImageRequest(topic);

    const systemPrompt = `You are a presentation outline generator. Output a JSON object with one key "outline" whose value is an ARRAY of slide objects.

EXAMPLE of correct output:
{"outline":[{"type":"title","title":"Introduction to AI","description":"Overview of AI and its impact"},{"type":"content","title":"What is AI?","description":"Definition and key concepts"},{"type":"stats","title":"AI by the Numbers","description":"Key statistics and growth data"}]}

STRICT RULES:
1. Return ONLY the JSON object. No markdown. No explanations.
2. "outline" MUST be an array of slides.
3. Each slide MUST have "type", "title", "description".
4. Valid types: ${allowImages ? '"title", "content", "image", "two-column", "quote", "timeline", "stats"' : '"title", "content", "two-column", "quote", "timeline", "stats"'}
5. First slide must be type "title". Last slide must be a conclusion.
6. ${isAuto ? "Generate 7-10 slides for the topic depth." : `Generate EXACTLY ${slideCount} slides.`}
7. EXACT USER STRUCTURE: If the user provides a specific slide-by-slide outline, use EXACTLY their outline and text. Do not invent your own structure if they provided one.
8. VARY FORMAT BY TOPIC: If no exact outline is provided, adapt slide types dynamically to the prompt. Avoid repetitive sequences.
9. NO EMPTY SLIDES: Every slide must be specific and strictly relevant. No filler. No empty place holder slides.
${styleContext}${learningContext}${structureContext}`;

    let lastError = null;
    let lastRaw = "";

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await callAiWithFallback({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Generate the presentation outline JSON for: ${topic}` },
                ],
                response_format: { type: "json_object" },
                max_tokens: 2000,
                temperature: 0.4 + (attempt * 0.2),
            });

            const raw = response.choices[0].message.content;
            lastRaw = raw;

            let data;
            try { data = JSON.parse(raw); }
            catch {
                const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
                if (m) data = JSON.parse(m[1]);
                else throw new Error("Not valid JSON");
            }

            const findArray = (obj) => {
                if (Array.isArray(obj)) return obj;
                if (obj && typeof obj === "object") {
                    for (const val of Object.values(obj)) {
                        if (Array.isArray(val) && val.length > 0) return val;
                    }
                    for (const val of Object.values(obj)) {
                        const f = findArray(val);
                        if (f && f.length > 0) return f;
                    }
                }
                return null;
            };

            const outline = findArray(data);
            if (!Array.isArray(outline) || outline.length === 0) {
                throw new Error(`No slide array. Got keys: ${Object.keys(data || {}).join(", ")}`);
            }

            const valid = outline.filter(s => s && s.title && s.type);
            if (valid.length === 0) throw new Error("Slides missing title/type");

            return valid;

        } catch (e) {
            console.error(`[generatePPTOutline] Attempt ${attempt + 1} failed:`, e.message);
            lastError = e;
        }
    }
    throw new Error(`Outline failed after 3 attempts: ${lastError?.message}`);
};

/**
 * Predict Theme using Groq
 */
export const predictThemeAi = async (prompt) => {
    const themes = ["Modern Sleek", "Vibrant Gradient", "Minimalist Light", "Midnight Neon", "Executive Blue", "Cyber Future", "Eco Nature", "Royal Gold", "Candy Pop", "Scholar Paper", "Abstract Glass", "High Impact", "Luxury Obsidian", "Neon Nights", "Glassmorphism Blur", "Earthy Neutrals"];
    try {
        const response = await callAiWithFallback({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: `You are an expert presentation designer. Predict the best design theme for the following presentation topic from this list: ${themes.join(', ')}. Return ONLY the exact theme name.` },
                { role: "user", content: `Topic: ${prompt}` },
            ],
            max_tokens: 50,
            temperature: 0.2,
        });
        const theme = response.choices[0]?.message?.content?.trim() || "Executive Blue";
        const cleanTheme = themes.find(t => theme.toLowerCase().includes(t.toLowerCase())) || "Executive Blue";
        return cleanTheme;
    } catch (error) {
        console.warn(`Groq predictTheme Failed (${error.message})`);
        return "Executive Blue";
    }
};

/**
 * Predict Structure using Groq
 */
export const predictStructureAi = async (prompt) => {

    try {
        const response = await callAiWithFallback({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: "Predict the best narrative structure (e.g., 'Problem-Solution with Data Evidence', 'Chronological Journey', 'High-Impact Persuasive Pitch', 'Deep Educational Deep-Dive') for a presentation about the user's topic. Make it descriptive to guide slide types. Return ONLY the structure name, no quotes, no extra text." },
                { role: "user", content: `Topic: ${prompt}` },
            ],
            max_tokens: 50,
            temperature: 0.2,
        });
        return response.choices[0]?.message?.content?.trim() || "Standard";
    } catch (error) {
        console.warn(`Groq predictStructure Failed (${error.message})`);
        return "Standard"; // fallback
    }
};

/**
 * Generate a new slide that fits contextually into an existing deck
 */
export const generateNewInsertedSlide = async (topic, currentSlides, insertIndex, styleGuide = null, sessionId = "anonymous") => {
    const learningContext = await getLearnedContext(sessionId);
    const prevSlide = insertIndex > 0 ? currentSlides[insertIndex - 1] : null;
    const nextSlide = insertIndex < currentSlides.length ? currentSlides[insertIndex] : null;

    const styleContext = styleGuide ? `Adhere to this design style guide extracted from a reference: ${JSON.stringify(styleGuide)}` : "";
    const allowImages = hasImageRequest(topic);

    const systemPrompt = `You are an expert presentation designer. Generate ONE new slide to be inserted into a deck about "${topic}".
    CONTEXT:
    ${prevSlide ? `- Previous Slide: "${prevSlide.title}"` : "- This is the first slide."}
    ${nextSlide ? `- Following Slide: "${nextSlide.title}"` : "- This is the last slide."}
    
    GOAL: Create a slide that bridges the content or adds missing depth.
    - ${styleContext}
    - IMPORTANT: Use styleGuide ONLY for visual theming. DO NOT use its content.
    - Choose fitting type: ${allowImages ? '"content", "image", "two-column", "quote", "timeline", "stats"' : '"content", "two-column", "quote", "timeline", "stats"'}.
    ${learningContext}
    - Respond strictly with JSON for ONE slide object.`;

    const response = await callAiWithFallback({
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Generate the best slide to fit this context." },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.7,
    });

    try {
        const slide = JSON.parse(response.choices[0].message.content);
        return slide;
    } catch (e) {
        throw new Error("Failed to generate contextual slide.");
    }
};

/**
 * PHASE 2: Generate content for a single slide based on the outline
 */
export const generateSingleSlideContent = async (topic, outline, slideIndex, styleGuide = null, sessionId = "anonymous") => {
    const learningContext = await getLearnedContext(sessionId);
    const slideMeta = outline[slideIndex];
    if (!slideMeta) throw new Error("Invalid slide index.");

    const truncatedTopic = topic.length > 600 ? topic.substring(0, 600) + "..." : topic;
    const styleContext = styleGuide ? `Style (colors/fonts only): ${JSON.stringify(styleGuide).slice(0, 200)}` : "";

    const typeExamples = {
        "title":      `{"type": "title", "title": "Catchy Title", "subtitle": "A one-line tagline"}`,
        "content":    `{"type": "content", "title": "Main Point", "bullets": ["Fact 1", "Fact 2", "Fact 3"]}`,
        "image":      `{"type": "image", "title": "Visual Concept", "bullets": ["Detail 1", "Detail 2"], "imageKeyword": "photorealistic abstract concept"}`,
        "two-column": `{"type": "two-column", "title": "Comparison", "leftColumn": {"heading": "Pros", "bullets": ["Point 1", "Point 2"]}, "rightColumn": {"heading": "Cons", "bullets": ["Point 1", "Point 2"]}}`,
        "quote":      `{"type": "quote", "title": "Expert Insight", "quote": "The actual quote text", "author": "Name or Role"}`,
        "timeline":   `{"type": "timeline", "title": "History", "timelineItems": [{"year": "2023", "event": "Launched"}, {"year": "2024", "event": "Expanded"}]}`,
        "stats":      `{"type": "stats", "title": "By the Numbers", "stats": [{"label": "Growth", "value": "150%"}, {"label": "Users", "value": "1M+"}]}`,
    };
    const example = typeExamples[slideMeta.type] || typeExamples["content"];

    const systemPrompt = `You are a presentation content generator. Return exactly ONE slide in pure JSON format.

Topic: "${truncatedTopic}"
Slide Type: ${slideMeta.type}
Slide Title: "${slideMeta.title}"
Slide Brief: ${slideMeta.description}

YOUR JSON OUTPUT MUST MATCH THIS EXACT SHAPE:
${example}

STRICT RULES:
1. Return ONLY valid JSON. No markdown. No explanations.
2. Fill the JSON with highly accurate, educational, and specific content.
3. NEVER leave arrays empty (bullets, timelineItems, stats). Provide 3-5 items. NO EMPTY SLIDES ALLOWED.
4. "imageKeyword" is optional.
5. Emulate ChatGPT's clear, deep, and structured output.
${styleContext}${learningContext}`;

    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await callAiWithFallback({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Generate the JSON for slide ${slideIndex + 1}: "${slideMeta.title}"` },
                ],
                response_format: { type: "json_object" },
                max_tokens: 1024,
                temperature: 0.5 + (attempt * 0.1),
            });

            const raw = response.choices[0].message.content;

            let slide;
            try {
                slide = JSON.parse(raw);
            } catch {
                const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
                if (match) slide = JSON.parse(match[1]);
                else throw new Error("Invalid JSON");
            }

            if (slide.imageKeyword) {
                const seed = Math.floor(Math.random() * 1000000);
                slide.image = `https://image.pollinations.ai/prompt/${encodeURIComponent(slide.imageKeyword)}?width=800&height=600&seed=${seed}&model=flux&nologo=true`;
            }

            return slide;

        } catch (e) {
            console.error(`[generateSingleSlideContent] Attempt ${attempt + 1} failed:`, e.message);
            lastError = e;
        }
    }

    throw new Error(`Failed to generate slide content after 3 attempts. Last error: ${lastError?.message}`);
};

/**
 * Text improvement engine using Groq
 */
export const improveTextEngine = async (text, action) => {
    let systemPrompt = "You are a direct textual assistant. Return ONLY the edited response exactly. Do NOT use quotes around your answer. Do NOT explain your answer.";
    if (action === "spelling") {
        systemPrompt += " Fix spelling and grammatical errors of the provided text while maintaining the original tone.";
    } else if (action === "autocomplete") {
        systemPrompt += " Complete the thought or sentence provided by the user naturally, adding professional polish and depth.";
    } else if (action === "improve") {
        systemPrompt += " Make the text sound significantly more professional, authoritative, and engaging. Transform basic sentences into expert bullet points suitable for a high-stakes business or academic presentation.";
    } else {
        systemPrompt += " Edit the text appropriately.";
    }

    const response = await callAiWithFallback({
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
        ],
        temperature: 0.3,
        max_tokens: 500,
    });
    
    return response.choices[0]?.message?.content?.trim() || text;
};

/**
 * Edit existing PPT slide content based on a prompt
 * Expects the current slides JSON array and a prompt describing requested changes.
 */
export const editPPTContent = async (prompt, currentSlides, sessionId = "anonymous") => {
    const systemPrompt = `You are an expert presentation designer and editor. 
You are given the JSON array of the CURRENT SLIDES of a presentation, and a USER REQUEST detailing how they want to edit or improve the presentation.
IMPORTANT INSTRUCTIONS:
- Apply the user's modifications to the presentation brilliantly. If they ask for expansion, add deep, valuable details and technical facts.
- PRESERVE ALL DATA: Do NOT remove or skip any information from the current slides unless specifically asked to delete it. Every bullet point must be preserved or improved, never lost.
- TEXT FIT: Keep bullet points clear and substantial (10-20 words). DO NOT OVERLAP.
- LOGIC: Ensure timelines make sense. Ensure content slides have bullets.
- IMAGES: Do NOT add images unless requested.
- SIMPLE MEANING: Maintain educational simplicity while providing deep value.
- CHATGPT STYLE: Emulate ChatGPT's clear, structured, and simple presentation style. Use easy definitions and analogies.
- FIX TITLES: If the input slides have numbers (1, 2, 3) as titles, REGENERATE proper descriptive titles based on the slide content.
- NO SELF-BRANDING: NEVER use "VisionText AI" as a title or content.
- VARIETY: Use diverse slide types but only if they fit the topic's logic.
- You MUST preserve any 'customStyles' objects.
- Respond ONLY with a valid JSON object containing a "slides" array.
${await getLearnedContext(sessionId)}`;

    const userMessage = `USER REQUEST: "${prompt}"

CURRENT SLIDES JSON:
${JSON.stringify(currentSlides, null, 2)}

Return the newly modified slides array as raw JSON.`;

    const response = await callAiWithFallback({
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
        ],
        max_tokens: 4000, // Reduced from 6000 to save TPD tokens
        temperature: 0.4,
        response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content || "{}";
    
    try {
        const jsonMatch = raw.match(/(\{\s*"slides"[\s\S]*\}\s*\}?)/m) 
            || raw.match(/(\[\s*\{[\s\S]*\}\s*\])/m) 
            || raw.match(/```(?:json)?\s*([\s\S]*?)```/);
            
        const jsonStr = jsonMatch ? jsonMatch[1] : raw;
        let parsed = JSON.parse(jsonStr);
        let slides = Array.isArray(parsed) ? parsed : (parsed.slides || parsed.presentation || []);
        
        // Post-process to ensure newly added images use Pollinations
        const finalSlides = slides.map(s => {
            if (s.imageKeyword && (!s.image || !s.image.includes('pollinations.ai'))) {
                const seed = Math.floor(Math.random() * 1000000);
                s.image = `https://image.pollinations.ai/prompt/${encodeURIComponent(s.imageKeyword)}?width=800&height=600&seed=${seed}&model=flux&nologo=true`;
            }
            return s;
        });

        return finalSlides;
    } catch (parseErr) {
        console.error("AI JSON Parse Error:", parseErr.message, "Raw was:", raw);
        throw new Error("AI did not return valid edited slide JSON. Please try again.");
    }
};

/**
 * Edit a SINGLE specific slide based on a prompt.
 * Expects a single slide object.
 */
export const editSingleSlideContent = async (prompt, slide, sessionId = "anonymous") => {
    const systemPrompt = `You are an expert presentation designer. 
You are given ONE CURRENT SLIDE and a USER REQUEST to refine or improve it.
IMPORTANT INSTRUCTIONS:
- Apply modifications simply and brilliantly.
- USE USER DATA if provided. Do not invent facts.
- TEXT FIT: Keep bullets short (max 12 words).
- IMAGES: Do NOT add unless requested.
- Preserve 'customStyles'.
- Return ONLY the updated slide object as JSON.
${await getLearnedContext(sessionId)}`;

    const userMessage = `USER REQUEST: "${prompt}"

CURRENT SLIDE JSON:
${JSON.stringify(slide, null, 2)}

Return the updated slide as a JSON object.`;

    const response = await callAiWithFallback({
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
        ],
        max_tokens: 3000,
        temperature: 0.3,
        response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content || "{}";

    try {
        let updatedSlide = JSON.parse(raw);
        // If it returns a slides array by mistake, pick first
        if (updatedSlide.slides && Array.isArray(updatedSlide.slides)) {
            updatedSlide = updatedSlide.slides[0];
        }

        // Fresh image if keyword changed
        if (updatedSlide.imageKeyword && updatedSlide.imageKeyword !== slide.imageKeyword) {
            const seed = Math.floor(Math.random() * 1000000);
            updatedSlide.image = `https://image.pollinations.ai/prompt/${encodeURIComponent(updatedSlide.imageKeyword)}?width=800&height=600&seed=${seed}&model=flux&nologo=true`;
        }

        return updatedSlide;
    } catch (err) {
        console.error("Single Slide Edit Parse Error:", err);
        throw new Error("Failed to refine slide. Please try again.");
    }
};
