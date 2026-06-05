const fs = require('fs');
const path = require('path');

const filePath = 'd:/ImageToPDF/backend/src/services/groq.service.js';
const content = fs.readFileSync(filePath, 'utf8');

// Find the start of generatePPTContent function
const startMarker = 'export const generatePPTContent = async';
const startIdx = content.indexOf(startMarker);

// Find the start of predictThemeAi — which is what should come AFTER generatePPTOutline
const endMarker = '/**\n * Predict Theme using Groq\n */';
let endIdx = content.indexOf(endMarker);

// Try another variation
if (endIdx === -1) {
    const alt = 'export const predictThemeAi';
    endIdx = content.indexOf(alt);
}

// Also try: 'Predict Structure using Groq'
if (endIdx === -1) {
    endIdx = content.indexOf('export const predictStructureAi');
}

console.log('startIdx:', startIdx, 'endIdx:', endIdx);
console.log('--- CONTENT BEFORE generatePPTContent (last 200 chars):');
console.log(JSON.stringify(content.substring(startIdx - 50, startIdx + 100)));
