async function test() {
    try {
        const res = await fetch("http://localhost:5000/api/v1/ai/generate-outline", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: "A presentation about test",
                slideCount: 0,
                structure: "Chronological"
            })
        });
        
        const data = await res.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

test();
