async function testLocalOutline() {
    try {
        const res = await fetch("http://localhost:5000/api/v1/ai/generate-outline", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "A presentation about climate change", slideCount: 8, structure: "Problem-Solution" })
        });
        console.log("Status:", res.status);
        const data = await res.text();
        console.log("Response:", data);
    } catch(err) {
        console.log("Error:", err);
    }
}
testLocalOutline();
