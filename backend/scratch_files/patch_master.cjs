const fs = require('fs');
const filePath = 'd:/ImageToPDF/backend/src/services/groq.service.js';
const content = fs.readFileSync(filePath, 'utf8');

// 1. Fix generatePPTOutline
let newContent = content;

// Replace the generatePPTOutline function
const outlineStart = newContent.indexOf('export const generatePPTOutline = async');
const outlineEnd = newContent.indexOf('export const predictThemeAi = async', outlineStart);
// Find the exact comment block start for predictThemeAi
const outlineEndReal = newContent.lastIndexOf('/**', outlineEnd);

const outlineReplacement = `export const generatePPTOutline = async (topic, slideCount = 8, styleGuide = null, sessionId = "anonymous", structure = null) => {
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

            return valid;

        } catch (e) {
            console.error(\`[generatePPTOutline] Attempt \${attempt + 1} failed:\`, e.message);
            lastError = e;
        }
    }
    throw new Error(\`Outline failed after 3 attempts: \${lastError?.message}\`);
};

`;

newContent = newContent.substring(0, outlineStart) + outlineReplacement + newContent.substring(outlineEndReal);

// 2. Fix generateSingleSlideContent
const singleStart = newContent.indexOf('export const generateSingleSlideContent = async');
const singleEnd = newContent.indexOf('export const improveTextEngine = async', singleStart);
const singleEndReal = newContent.lastIndexOf('/**', singleEnd);

const singleReplacement = `export const generateSingleSlideContent = async (topic, outline, slideIndex, styleGuide = null, sessionId = "anonymous") => {
    const learningContext = await getLearnedContext(sessionId);
    const slideMeta = outline[slideIndex];
    if (!slideMeta) throw new Error("Invalid slide index.");

    const truncatedTopic = topic.length > 600 ? topic.substring(0, 600) + "..." : topic;
    const styleContext = styleGuide ? \`Style (colors/fonts only): \${JSON.stringify(styleGuide).slice(0, 200)}\` : "";

    const typeExamples = {
        "title":      \`{"type": "title", "title": "Catchy Title", "subtitle": "A one-line tagline"}\`,
        "content":    \`{"type": "content", "title": "Main Point", "bullets": ["Fact 1", "Fact 2", "Fact 3"]}\`,
        "image":      \`{"type": "image", "title": "Visual Concept", "bullets": ["Detail 1", "Detail 2"], "imageKeyword": "photorealistic abstract concept"}\`,
        "two-column": \`{"type": "two-column", "title": "Comparison", "leftColumn": {"heading": "Pros", "bullets": ["Point 1", "Point 2"]}, "rightColumn": {"heading": "Cons", "bullets": ["Point 1", "Point 2"]}}\`,
        "quote":      \`{"type": "quote", "title": "Expert Insight", "quote": "The actual quote text", "author": "Name or Role"}\`,
        "timeline":   \`{"type": "timeline", "title": "History", "timelineItems": [{"year": "2023", "event": "Launched"}, {"year": "2024", "event": "Expanded"}]}\`,
        "stats":      \`{"type": "stats", "title": "By the Numbers", "stats": [{"label": "Growth", "value": "150%"}, {"label": "Users", "value": "1M+"}]}\`,
    };
    const example = typeExamples[slideMeta.type] || typeExamples["content"];

    const systemPrompt = \`You are a presentation content generator. Return exactly ONE slide in pure JSON format.

Topic: "\${truncatedTopic}"
Slide Type: \${slideMeta.type}
Slide Title: "\${slideMeta.title}"
Slide Brief: \${slideMeta.description}

YOUR JSON OUTPUT MUST MATCH THIS EXACT SHAPE:
\${example}

STRICT RULES:
1. Return ONLY valid JSON. No markdown. No explanations.
2. Fill the JSON with highly accurate, educational, and specific content.
3. NEVER leave arrays empty (bullets, timelineItems, stats). Provide 3-5 items.
4. "imageKeyword" is optional.
5. Emulate ChatGPT's clear and structured output.
\${styleContext}\${learningContext}\`;

    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await callAiWithFallback({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: \`Generate the JSON for slide \${slideIndex + 1}: "\${slideMeta.title}"\` },
                ],
                response_format: { type: "json_object" },
                max_tokens: 1500,
                temperature: 0.5 + (attempt * 0.1),
            });

            const raw = response.choices[0].message.content;

            let slide;
            try {
                slide = JSON.parse(raw);
            } catch {
                const match = raw.match(/\`\`\`(?:json)?\\s*([\\s\\S]*?)\`\`\`/) || raw.match(/(\\{[\\s\\S]*\\})/);
                if (match) slide = JSON.parse(match[1]);
                else throw new Error("Invalid JSON");
            }

            if (slide.imageKeyword) {
                const seed = Math.floor(Math.random() * 1000000);
                slide.image = \`https://image.pollinations.ai/prompt/\${encodeURIComponent(slide.imageKeyword)}?width=800&height=600&seed=\${seed}&model=flux&nologo=true\`;
            }

            return slide;

        } catch (e) {
            console.error(\`[generateSingleSlideContent] Attempt \${attempt + 1} failed:\`, e.message);
            lastError = e;
        }
    }

    throw new Error(\`Failed to generate slide content after 3 attempts. Last error: \${lastError?.message}\`);
};

`;

newContent = newContent.substring(0, singleStart) + singleReplacement + newContent.substring(singleEndReal);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully patched groq.service.js');
