async function testProdOutline() {
    try {
        const res = await fetch("https://image-to-text-ai-tool.onrender.com/api/v1/ai/generate-outline", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "Green Energy", slideCount: 8, styleGuide: null })
        });
        console.log("Status:", res.status);
        const data = await res.text();
        console.log("Response:", data);
    } catch(err) {
        console.log("Error:", err);
    }
}
testProdOutline();
