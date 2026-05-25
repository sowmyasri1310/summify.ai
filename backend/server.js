import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import summaryRoutes from './routes/summary.js';

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/summarizer';

const model = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
});

app.use(cors());

app.use(express.json({ limit: '20mb' }));

app.use(express.urlencoded({
  limit: '20mb',
  extended: true
}));

app.use('/api', summaryRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Content Summarizer API is running successfully.'
  });
});

app.get('/test-trace', async (req, res) => {
  try {

    const result =
      await model.invoke("Say hello from Gemini");

    res.json({
      success: true,
      output: result.content,
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
});

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB.');
  })
  .catch((err) => {
    console.error(
      'MongoDB connection failed:',
      err.message
    );
  });

if (!process.env.VERCEL) {

  app.listen(PORT, () => {

    console.log(
      `Server running on port ${PORT}`
    );

  });

}

export default app;