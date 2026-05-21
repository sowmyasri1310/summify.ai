import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import summaryRoutes from './routes/summary.js';

// Load environment variables dynamically
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/summarizer';

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Routes
app.use('/api', summaryRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Content Summarizer API is running successfully.' });
});

// Database Connection with graceful fallback
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB.');
  })
  .catch((err) => {
    console.error('MongoDB connection failed. Continuing in local-only / memory-cached backup mode:', err.message);
    console.info('Please verify MongoDB is installed and running, or update your MONGO_URI.');
  });

// Start Server (only locally, Vercel handles serverless execution)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running in development mode on port ${PORT}`);
    console.log(`API URL: http://localhost:${PORT}/api`);
  });
}

export default app;
