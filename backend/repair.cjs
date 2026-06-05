const fs = require('fs');
const file = 'd:/ImageToPDF/backend/src/services/groq.service.js';
let content = fs.readFileSync(file, 'utf8');
// Find the last actual closing brace
const lastBraceIndex = content.lastIndexOf('};');
if (lastBraceIndex !== -1) {
    content = content.substring(0, lastBraceIndex + 2) + '\n';
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed file');
} else {
    console.log('Could not find last brace');
}
