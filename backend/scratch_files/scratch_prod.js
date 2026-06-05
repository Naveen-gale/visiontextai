async function testProd() {
    try {
        const res = await fetch("https://image-to-text-ai-tool.onrender.com/api/v1/ai/predict-structure", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "A presentation about test" })
        });
        console.log("Status:", res.status);
        const data = await res.text();
        console.log("Response:", data);
    } catch(err) {
        console.log("Error:", err);
    }
}
testProd();
