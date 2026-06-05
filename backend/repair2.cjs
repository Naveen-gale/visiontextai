const fs = require('fs');
const filePath = 'd:/ImageToPDF/backend/src/services/groq.service.js';
const content = fs.readFileSync(filePath, 'utf8');

// Everything before generatePPTContent
const beforeStart = content.substring(0, 17128);

// Everything from predictStructureAi onwards
const afterStart = content.indexOf('export const predictStructureAi');
const afterContent = content.substring(afterStart);

// The correct replacement block for generatePPTContent + generatePPTOutline
const replacement = `export const generatePPTContent = async (prompt, base64Image = null, mimeType = "image/jpeg", slideCount = 8, sessionId = "anonymous", structure = null) => {
    const learningContext = await getLearnedContext(sessionId);
    // NOTE: structureContext omitted — injecting structure names causes llama to return {"structure":"..."} instead of slides.
    const structureContext = "";
    const systemPrompt = \`You are an expert presentation designer. Your ENTIRE output must be driven by the user's prompt — topic, tone, and structure.

CRITICAL RULES:
1. SLIDE VARIETY: Use a diverse mix of types. DO NOT repeat the same type consecutively. Types: "title", "content", "image", "two-column", "quote", "timeline", "stats".
2. Slide 1 MUST be "title". ALL other slides (except possibly a concluding slide) MUST be content-heavy types: "content", "two-column", "timeline", "stats", or "image". NEVER use "title" type for middle slides.
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
10. RETURN FORMAT: Respond with JSON: { "slides": [ ... ] }

\${learningContext}\${structureContext}\`;

    const userMessages = [];
    if (base64Image) {
        userMessages.push({
            role: "user",
            content: [
                { type: "text", text: \`Create a \${slideCount}-slide presentation: \${prompt}\` },
                { type: "image_url", image_url: { url: \`data:\${mimeType};base64,\${base64Image}\` } },
            ],
        });
    } else {
        userMessages.push({
            role: "user",
            content: \`Create a \${slideCount}-slide presentation about: \${prompt}. Make every slide type different from adjacent slides. Keep bullet text concise (8-14 words per bullet).\`,
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
    const jsonMatch = raw.match(/(\\{\\s*"slides"[\\s\\S]*?\\}\\s*\\]\\s*\\})/m)
        || raw.match(/(\\{\\s*"slides"[\\s\\S]*\\})/m)
        || raw.match(/(\\[\\s*\\{[\\s\\S]*\\}\\s*\\])/m)
        || raw.match(/\`\`\`(?:json)?\\s*([\\s\\S]*?)\`\`\`/);

    const jsonStr = jsonMatch ? jsonMatch[1] : raw;

    try {
        let slides = JSON.parse(jsonStr);
        slides = Array.isArray(slides) ? slides : (slides.slides || slides.presentation || []);
        return slides.map(s => {
            if (s.imageKeyword) {
                const seed = Math.floor(Math.random() * 1000000);
                s.image = \`https://image.pollinations.ai/prompt/\${encodeURIComponent(s.imageKeyword)}?width=800&height=600&seed=\${seed}&model=flux&nologo=true\`;
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
    const styleContext = styleGuide ? \`Adhere to this design style guide: \${JSON.stringify(styleGuide)}\` : "";

    const systemPrompt = \`You are a presentation outline generator. Output a JSON object with one key "outline" whose value is an ARRAY of slide objects.

EXAMPLE of correct output:
{"outline":[{"type":"title","title":"Introduction to AI","description":"Overview of AI and its impact"},{"type":"content","title":"What is AI?","description":"Definition and key concepts"},{"type":"stats","title":"AI by the Numbers","description":"Key statistics and growth data"}]}

STRICT RULES:
1. Return ONLY the JSON object. No markdown. No explanations.
2. "outline" MUST be an array of slides.
3. Each slide MUST have "type", "title", "description".
4. Valid types: "title", "content", "image", "two-column", "quote", "timeline", "stats"
5. First slide must be type "title". Last slide must be a conclusion.
6. \${isAuto ? "Generate 7-10 slides for the topic depth." : \`Generate EXACTLY \${slideCount} slides.\`}
7. Slides must be specific and relevant. No filler.
8. Do NOT repeat same slide type consecutively.
\${styleContext}\${learningContext}\`;

    let lastError = null;
    let lastRaw = "";

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await callAiWithFallback({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: \`Generate the presentation outline JSON for: \${topic}\` },
                ],
                response_format: { type: "json_object" },
                max_tokens: 2000,
                temperature: 0.4 + (attempt * 0.2),
            });

            const raw = response.choices[0].message.content;
            lastRaw = raw;
            console.log(\`[generatePPTOutline] Attempt \${attempt + 1} RAW:\`, raw.substring(0, 200));

            let data;
            try { data = JSON.parse(raw); }
            catch {
                const m = raw.match(/\`\`\`(?:json)?\\s*([\\s\\S]*?)\`\`\`/) || raw.match(/(\\{[\\s\\S]*\\})/);
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
                throw new Error(\`No slide array. Got keys: \${Object.keys(data || {}).join(", ")}\`);
            }

            const valid = outline.filter(s => s && s.title && s.type);
            if (valid.length === 0) throw new Error("Slides missing title/type");

            console.log(\`[generatePPTOutline] ✅ \${valid.length} slides OK\`);
            return valid;

        } catch (e) {
            console.error(\`[generatePPTOutline] Attempt \${attempt + 1} failed:\`, e.message);
            lastError = e;
        }
    }
    throw new Error(\`Outline failed after 3 attempts: \${lastError?.message}\`);
};

`;

const newContent = beforeStart + replacement + afterContent;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('File rebuilt successfully. New length:', newContent.length);
