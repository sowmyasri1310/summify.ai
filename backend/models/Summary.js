import mongoose from 'mongoose';

const summarySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  originalText: {
    type: String,
    required: true
  },
  sourceType: {
    type: String,
    enum: ['text', 'url', 'file'],
    default: 'text'
  },
  sourceUrl: {
    type: String,
    required: false
  },
  summary: {
    type: String,
    required: true
  },
  options: {
    format: {
      type: String,
      required: true
    },
    mood: {
      type: String,
      required: true
    },
    length: {
      type: String,
      required: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add a text index for full-text search in history
summarySchema.index({ title: 'text', originalText: 'text', summary: 'text' });

const Summary = mongoose.model('Summary', summarySchema);
export default Summary;
