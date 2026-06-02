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
 */
export const generatePPTContent = async (prompt, base64Image = null, mimeType = "image/jpeg", slideCount = 8, sessionId = "anonymous") => {
    const learningContext = await getLearnedContext(sessionId);
    const systemPrompt = `You are an expert presentation designer. Your ENTIRE output must be driven by the user's prompt — topic, tone, and structure.

CRITICAL RULES:
1. SLIDE VARIETY: Use a diverse mix of types. DO NOT repeat the same type consecutively. Types: "title", "content", "image", "two-column", "quote", "timeline", "stats".
2. Slide 1 MUST be "title". ALL other slides (except possibly a concluding 'quote' or 'title' slide at the very end) MUST be content-heavy types: "content", "two-column", "timeline", "stats", or "image". NEVER use "title" type for middle slides.
3. CONTENT per slide:
   - Mix longer, detailed explanations with short, punchy bullet points to ensure the user perfectly understands the PPT output. Make it high-level, perfect output like GPT.
   - "content": 3-5 punchy bullets, each 6-12 words, plus deeper details if needed.
   - "two-column": Simple comparison.
   - "stats": Use the user's data EXACTLY if provided.
   - "timeline": Logical steps (Step 1, Step 2...).
   - "quote": One powerful quote.
   - "title": ONLY Slide 1 and optionally the final slide.
4. FOLLOW USER STRUCTURE: If the prompt contains a list like "Slide 1, Slide 2...", you MUST follow that exact structure.
5. NO EMPTY PAGES. Every user's PPT MUST be unique, highly accurate, and precisely follow their prompt.
6. SIMPLE DEFINITIONS: For complex terms, always provide a "Simple Definition: [Definition]" bullet. Emulate GPT's clear, educational, and structured presentation style.
7. NO FILLER: No "Key point here". Just the facts/meaning simply. 
8. imageKeyword: ONLY generate an image keyword if the user explicitly says "okay" to images or specifically requests one. Otherwise, leave it empty ("").
9. NO SELF-BRANDING: NEVER use the words "VisionText AI" or any software names.
${learningContext}

Respond ONLY with a valid JSON object: { "slides": [ ...slide objects ] }
Each slide object:
{
  "type": "title"|"content"|"image"|"two-column"|"quote"|"timeline"|"stats",
  "title": "...",
  "subtitle": "...",
  "bullets": ["..."],
  "quote": "...",
  "author": "...",
  "leftColumn": { "heading": "...", "bullets": ["..."] },
  "rightColumn": { "heading": "...", "bullets": ["..."] },
  "stats": [{"label": "...", "value": "..."}],
  "timelineItems": [{"year": "...", "event": "..."}],
  "imageKeyword": "", 
  "speakerNotes": "..."
}
`;

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
        max_tokens: 4096,
        temperature: 0.55,
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
 * PHASE 1: Generate an outline for the presentation
 */
export const generatePPTOutline = async (topic, slideCount = 8, styleGuide = null, sessionId = "anonymous") => {
    const learningContext = await getLearnedContext(sessionId);
    const isAuto = slideCount === 0;
    const styleContext = styleGuide ? `Adhere to this design style guide extracted from a reference: ${JSON.stringify(styleGuide)}` : "";
    
    const systemPrompt = `You are a professional presentation architect. Your task is to plan a high-quality presentation.
    - Create a coherent, engaging narrative flow with a strong opening and clear conclusion.
    - ${isAuto ? "Choose an appropriate slide count based on the topic depth." : `Plan exactly ${slideCount} slides.`}
    - IF USER PROVIDED A LIST OF SLIDES (Slide 1, Slide 2...), USE THEM EXACTLY. DO NOT summarize or skip them.
    - NO empty pages. Every user's PPT should be unique and highly accurate according to their prompt. Provide a high-level, perfectly structured GPT-like outline.
    - For each slide, determine: "type", "title", and "description".
    - Slide types: "title", "content", "image", "two-column", "quote", "timeline", "stats".
    - To ensure unique creativity, here is a random seed: ${Math.random()}. Do not generate the exact same outline as previous attempts.
    - Respond strictly with JSON: { "outline": [ ... ] }`;

    const response = await callAiWithFallback({
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Outline a ${isAuto ? "professionally structured" : slideCount + "-slide"} presentation about: ${topic}` },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000, // Enough for 16+ slides with meaningful descriptions
        temperature: 0.6,
    });

    try {
        const data = JSON.parse(response.choices[0].message.content);
        return data.outline || [];
    } catch (e) {
        console.error("Outline Parse Failed:", e.message);
        throw new Error("Failed to generate outline.");
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

    const systemPrompt = `You are an expert presentation designer. Generate ONE new slide to be inserted into a deck about "${topic}".
    CONTEXT:
    ${prevSlide ? `- Previous Slide: "${prevSlide.title}"` : "- This is the first slide."}
    ${nextSlide ? `- Following Slide: "${nextSlide.title}"` : "- This is the last slide."}
    
    GOAL: Create a slide that bridges the content or adds missing depth.
    - ${styleContext}
    - IMPORTANT: Use styleGuide ONLY for visual theming. DO NOT use its content.
    - Choose fitting type: "content", "image", "two-column", "quote", "timeline", "stats".
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

    // Per-type instructions: what fields + concise length guidance
    const typeRules = {
        "title":      "title (short, catchy), subtitle (1 line tagline). NO bullets.",
        "content":    "title, bullets: 3-5 items, each 8-12 words, factual and specific.",
        "image":      "title, bullets: 2-3 items (8-10 words each), imageKeyword: vivid photorealistic scene.",
        "two-column": "title, leftColumn {heading, bullets: 3 items, 8-10 words each}, rightColumn {heading, bullets: 3 items, 8-10 words each}.",
        "quote":      "title, quote (15-25 words, powerful and relevant), author (real name or role).",
        "timeline":   "title, timelineItems: 4-5 items each with year and event (8-12 words).",
        "stats":      "title, stats: 4-5 items each with label (2-4 words) and value (number/%). Use realistic data.",
    };
    const rule = typeRules[slideMeta.type] || typeRules["content"];

const systemPrompt = `Generate ONE presentation slide as JSON.
Topic: "${truncatedTopic}"
Slide ${slideIndex + 1}/${outline.length} | Type: ${slideMeta.type} | Title: "${slideMeta.title}"
Brief: ${slideMeta.description}

- Fields to fill: ${rule}
- Content: USE USER DATA IF PROVIDED. Mix longer, detailed explanations with short, punchy bullet points to ensure the user perfectly understands the PPT output.
- CHATGPT STYLE: Emulate GPT's high-level, perfect output. Make it clear, highly educational, and well-structured. Provide clear analogies and simple definitions.
- NO empty pages. EVERY user's PPT MUST be unique, highly accurate, and precisely follow their prompt.
- imageKeyword: ONLY generate an image keyword if the user explicitly said "okay" to images or specifically requested one. Otherwise, leave it empty ("").
- NO jargon unless explained. NO placeholder text. NO filler.
- speakerNotes: 1 sentence only.
- CRITICAL: Arrays (bullets, timelineItems, stats) MUST NOT BE EMPTY! If the type requires an array, you MUST provide at least 3 high-quality items. Empty arrays will crash the system.
- Random Seed for Uniqueness: ${Math.random()}
${styleContext}${learningContext}

Return ONLY valid JSON. Ensure all arrays (bullets, timelineItems, stats, leftColumn.bullets, rightColumn.bullets) are NOT empty! NEVER leave a slide blank!`;

    const response = await callAiWithFallback({
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Create slide ${slideIndex + 1}: "${slideMeta.title}" (type: ${slideMeta.type})` },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500, // Increased for more detailed slides
        temperature: 0.6,
    });

    try {
        const slide = JSON.parse(response.choices[0].message.content);
        
        // Post-process image if needed
        if (slide.imageKeyword) {
            const seed = Math.floor(Math.random() * 1000000);
            slide.image = `https://image.pollinations.ai/prompt/${encodeURIComponent(slide.imageKeyword)}?width=800&height=600&seed=${seed}&model=flux&nologo=true`;
        }
        
        return slide;
    } catch (e) {
        throw new Error(`Failed to generate slide content for slide ${slideIndex + 1}`);
    }
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
