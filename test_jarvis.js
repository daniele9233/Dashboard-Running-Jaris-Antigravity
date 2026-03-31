// Test Jarvis endpoint on production (Render)
const test = async () => {
    console.log("=== Testing Jarvis on PRODUCTION (Render) ===");
    console.log("Timestamp:", new Date().toISOString());
    
    try {
        const start = Date.now();
        const res = await fetch("https://dani-backend-ea0s.onrender.com/api/jarvis/chat", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({transcript: "ciao jarvis dimmi le mie statistiche"})
        });
        const elapsed = Date.now() - start;
        const data = await res.json();
        
        console.log("\n--- RESULT ---");
        console.log("HTTP Status:", res.status);
        console.log("Response time:", elapsed, "ms");
        console.log("Text:", data.text);
        console.log("Action:", JSON.stringify(data.action));
        console.log("Has audio?", !!data.audio);
        if (data.audio) {
            console.log("Audio length (base64 chars):", data.audio.length);
        }
        if (data.error) {
            console.log("ERROR:", data.error);
        }
        if (data.text && data.text.startsWith("DEBUG:")) {
            console.log("\n⚠️ PROBLEM: Response starts with DEBUG, means the Gemini API failed!");
            console.log("Full error:", data.text);
        }
    } catch (e) {
        console.error("FETCH ERROR:", e.message);
    }
};

test();
