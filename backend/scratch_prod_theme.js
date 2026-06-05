async function testTheme() {
    try {
        const res = await fetch("https://image-to-text-ai-tool.onrender.com/api/v1/ai/predict-theme", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "Green Energy" })
        });
        console.log("Status:", res.status);
        const data = await res.text();
        console.log("Response:", data);
    } catch(err) {
        console.log("Error:", err);
    }
}
testTheme();
