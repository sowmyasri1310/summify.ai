# Summify.AI — Intelligent Content Summarizer 🚀

Summify.AI is a premium, high-fidelity AI-powered content summarization platform featuring a futuristic glassmorphic user interface, advanced multi-format parsing, visual document analysis (OCR), and fluid, natural Text-to-Speech (TTS) capabilities.

---

## 🌟 Key Features

* **Multi-Source Summarization**:
  * **Raw Text / Notes**: Direct input with instant word/character counter.
  * **Article / Blog Scraping**: Extracts main article bodies, skipping headers, menus, and footers.
  * **File & Image Upload**: Supports `.txt`, `.md`, `.pdf` documents, and images (`.png`, `.jpg`, `.webp`).
* **Advanced Content Extraction (OCR & Parser v2)**:
  * **TypeScript-Powered PDF Extraction**: High-fidelity text retrieval from PDF streams using `pdf-parse` v2.
  * **Multimodal Vision Analysis**: Captures visual components, handwritten text, and contextual layout structures in images using Gemini & GPT-4o-mini endpoints.
* **Custom AI Persona Options**:
  * Tailor summaries to target personas: *Beginner*, *Student*, *Researcher*, *CEO*, *Child*, or a custom user-defined prompt.
* **Multi-Format Layouts**:
  * Output formats include *Cohesive Narrative Paragraphs*, *Structured Bullet Points*, *Impactful Key Takeaways*, or interactive *Q&A/FAQs*.
* **Interactive Text-to-Speech (TTS)**:
  * High-fidelity, real-time audio playback utilizing natural speech synthesis with rate adjustments and seamless play/pause/stop triggers.
* **History Log**:
  * Secure, searchable history stored in MongoDB Atlas, with quick load and delete actions.

---

## 💻 Tech Stack

* **Frontend**: React, Vite, Vanilla CSS (Glassmorphism), Lucide React
* **Backend**: Express, Node.js (ESM), Mongoose, Axios, Cheerio, PDF-Parse (v2.4.5)
* **AI API Endpoints**: Google Generative AI (Gemini), OpenAI (GPT-4o-mini), x.ai (Grok)
* **Database**: MongoDB Atlas Cloud Cluster

---

## 🚀 Quick Start (Local Run)

### Prerequisites
* **Node.js**: >= 20.x
* **MongoDB**: Standard local instance or MongoDB Atlas Connection URI
* **API Keys**: Google Gemini, OpenAI, or x.ai keys

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sowmyasri1310/summify.ai.git
   cd summify.ai
   ```

2. **Run Backend**:
   ```bash
   cd backend
   # Copy env template and set your API keys & MONGO_URI
   cp .env.example .env 
   npm install
   npm run dev
   ```

3. **Run Frontend**:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

4. Open `http://localhost:5173` in your browser.

---

## ☁️ Deployment on Vercel

Refer to our complete [Vercel Deployment Guide](vercel_deployment_guide.md) inside the project for detailed, step-by-step instructions on deploying the frontend and backend to Vercel as serverless services.
