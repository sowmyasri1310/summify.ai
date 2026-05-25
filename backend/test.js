import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function run() {
    try {
        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: "Hello" }],
            temperature: 0.3,
        });

        console.log(
            completion.choices[0].message.content
        );
    } catch (error) {
        console.error("Error connecting to Groq:", error);
    }
}

run();