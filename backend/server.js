import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
console.log(process.env);


import summaryRoutes from './routes/summary.js';

import { ChatGroq } from "@langchain/groq";



const app = express();

const PORT = process.env.PORT || 5000;

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/summarizer';

/* =========================
   LANGSMITH ENV CHECK
========================= */

if (!process.env.LANGSMITH_API_KEY) {
  console.warn(
    "⚠️ LANGSMITH_API_KEY is missing"
  );
}

if (!process.env.GROQ_API_KEY) {
  console.warn(
    "⚠️ GROQ_API_KEY is missing"
  );
}

/* =========================
   GROQ MODEL
========================= */

const model = new ChatGroq({
  model: "llama-3.1-8b-instant",
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0.3,
});
console.log("USING MODEL: llama-3.1-8b-instant");

/* =========================
   MIDDLEWARE
========================= */

app.use(cors());

app.use(express.json({
  limit: '20mb'
}));

app.use(express.urlencoded({
  limit: '20mb',
  extended: true
}));

/* =========================
   ROUTES
========================= */

app.use('/api', summaryRoutes);

/* =========================
   HOME ROUTE
========================= */

app.get('/', (req, res) => {

  res.json({
    success: true,
    message:
      'Content Summarizer API is running successfully.',
    langsmithTracing:
      process.env.LANGSMITH_TRACING === "true",
  });

});

/* =========================
   LANGSMITH TEST ROUTE
========================= */

app.get('/test-trace', async (req, res) => {

  try {

    console.log(
      "Sending request to Groq..."
    );

    const result = await model.invoke(
      "Say hello from Groq and explain AI in one sentence."
    );

    console.log(
      "Groq response received."
    );

    res.json({
      success: true,
      output: result.content,
    });

  } catch (error) {

    console.error(
      "Trace test failed:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message,
    });

  }

});

/* =========================
   DATABASE CONNECTION
========================= */

mongoose.connect(MONGO_URI)
  .then(() => {

    console.log(
      '✅ Successfully connected to MongoDB.'
    );

  })
  .catch((err) => {

    console.error(
      '❌ MongoDB connection failed:',
      err.message
    );

  });

/* =========================
   START SERVER
========================= */

if (!process.env.VERCEL) {

  app.listen(PORT, () => {

    console.log(
      `🚀 Server running on port ${PORT}`
    );

    console.log(
      `📊 LangSmith tracing: ${process.env.LANGSMITH_TRACING}`
    );

  });

}

export default app;