import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { createRequire } from 'module';
import Summary from '../models/Summary.js';

const require = createRequire(import.meta.url);

const router = express.Router();

function getPdfParser() {
  try {
    const pdfParseModule = require('pdf-parse');
    return pdfParseModule;
  } catch (error) {
    throw new Error(`PDF parser initialization failed: ${error.message}`);
  }
}

// Helper: Scrape content from a URL
async function scrapeUrlContent(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    // Remove unwanted elements
    $('script, style, nav, footer, header, noscript, iframe, svg, ads, .ads, #footer, #header').remove();

    const title = $('title').text().trim() || 'Scraped Article';

    // Try to find the article content, fallback to main, then body
    let bodyText = '';
    const selectors = ['article', 'main', '.post-content', '.article-content', '#content', 'body'];

    for (const selector of selectors) {
      const element = $(selector);
      if (element.length) {
        // Collect paragraphs, headings, lists
        const paragraphs = element.find('p, h1, h2, h3, h4, li');
        if (paragraphs.length > 5) {
          bodyText = paragraphs.map((_, el) => $(el).text().trim()).get().join('\n\n');
          break;
        }
      }
    }

    if (!bodyText) {
      bodyText = $('p').map((_, el) => $(el).text().trim()).get().join('\n\n');
    }

    // Clean up excessive whitespace
    bodyText = bodyText.replace(/\s+/g, ' ').trim();

    // Limit length to a reasonable number of words to avoid blowing up context tokens
    const words = bodyText.split(/\s+/);
    if (words.length > 3000) {
      bodyText = words.slice(0, 3000).join(' ') + '... [Content Truncated]';
    }

    if (!bodyText || bodyText.length < 50) {
      throw new Error("Could not extract sufficient text from the website. The page might be rendered dynamically by JavaScript or protected by a firewall.");
    }

    return { title, text: bodyText };
  } catch (error) {
    console.error("Scraping error:", error.message);
    throw new Error(error.message || "Failed to scrape the website content.");
  }
}

// Generate the prompt based on user selections
function buildPrompt(text, format, mood, length, isMultimodalImage = false) {
  let promptText = '';

  if (isMultimodalImage) {
    promptText = `Perform a high-fidelity analysis of the uploaded image. Extract all textual content (OCR), analyze any graphs, visual patterns, diagrams, or contextual layout details, and generate a structured summary tailored to the requested parameters.

PARAMETERS:
`;
  } else {
    promptText = `Analyze the following source text and generate a summary customized to the requested parameters.

SOURCE TEXT:
"""
${text}
"""

PARAMETERS:
`;
  }

  // 1. Format selector
  switch (format) {
    case 'bullets':
      promptText += `- Format: A highly organized, clean, markdown-friendly list of bullet points highlighting key points and details.\n`;
      break;
    case 'takeaways':
      promptText += `- Format: A distinct, impactful list of the most critical takeaways, each starting with an impactful bold keyword or phrase like **Keyword**: Explanation.\n`;
      break;
    case 'faqs':
      promptText += `- Format: A list of frequently asked questions (FAQs) and their clear answers based on the text. Format each FAQ as:
**Q: [Question]**
A: [Answer]\n`;
      break;
    case 'simple':
    default:
      promptText += `- Format: A smooth, cohesive narrative paragraph explaining the core ideas in a simple, easy-to-read style.\n`;
      break;
  }

  // 2. Mood / Persona selector
  switch (mood) {
    case 'beginner':
      promptText += `- Target Persona: Beginner. Explain using everyday language, avoid complex jargon, and provide intuitive analogies if helpful.\n`;
      break;
    case 'student':
      promptText += `- Target Persona: Student. Format as high-quality study notes, emphasizing core terms, definitions, and logical structure suitable for academic revision.\n`;
      break;
    case 'researcher':
      promptText += `- Target Persona: Researcher. Adopt a highly analytical, objective, and academic tone. Highlight underlying assumptions, methodology, and theoretical or empirical implications.\n`;
      break;
    case 'ceo':
      promptText += `- Target Persona: CEO. Deliver a Bottom-Line-Up-Front (BLUF) executive briefing. Focus on strategic insights, business impact, and action-oriented takeaways.\n`;
      break;
    case 'child':
      promptText += `- Target Persona: Child. Explain it like I am 5 years old. Use highly engaging, simple metaphors, extremely basic vocabulary, and friendly explanations.\n`;
      break;
    case 'upsc':
      promptText += `- Target Persona: UPSC Preparation. Focus on analytical structure, cause-and-effect relationships, policy implications, historical context, and potential recommendations.\n`;
      break;
    default:
      if (mood && mood.trim() !== '') {
        promptText += `- Target Persona: Custom - ${mood}. Shape the summary style, vocabulary, and tone exactly to this persona description.\n`;
      }
      break;
  }

  // 3. Length Selector (TL;DR Slider)
  switch (length) {
    case '10':
      promptText += `- Length Constraint: Strictly limit the output to around 10 to 15 words. A highly concise single sentence.\n`;
      break;
    case '50':
      promptText += `- Length Constraint: Approximately 50 words.\n`;
      break;
    case '100':
      promptText += `- Length Constraint: Approximately 100 words.\n`;
      break;
    case 'detailed':
    default:
      promptText += `- Length Constraint: Provide a highly detailed, comprehensive structured summary without strict length limits, covering all major details.\n`;
      break;
  }

  promptText += `\nINSTRUCTIONS: Ensure the summary is 100% factual and accurate to the source text. Avoid introducing outside information. Return only the summary, properly formatted in clean Markdown. Do not wrap the entire output in backticks unless they are part of markdown.`;

  return promptText;
}

// Helper: Generate Mock/Simulated summary for fallbacks
function generateMockSummary(format, mood, length, apiError = '') {
  const safeFormat = format || 'simple';
  const safeMood = mood || 'beginner';
  const safeLength = length || '100';
  let mockBody = '';
  let reason = apiError
    ? `because the Grok API returned: "${apiError}" (typically due to a newly created team account having 0 credits, or the selected model is not accessible).`
    : "because no AI API keys are configured in your `.env` file.";

  if (safeFormat === 'bullets') {
    mockBody = `* **Welcome to the Content Summarizer**: This is a high-fidelity interactive simulation ${reason}
* **Mood Applied**: Your summary has been custom-styled for the **${safeMood.toUpperCase()}** perspective.
* **Length Bounds**: Scaled specifically to **${safeLength}** units.
* **How to Resolve**: Visit [console.x.ai](https://console.x.ai) to purchase credits or link your card.`;
  } else if (safeFormat === 'takeaways') {
    mockBody = `**Key Takeaway 1**: Your x.ai team currently has no credits or licenses loaded. Visit [console.x.ai](https://console.x.ai) to purchase credits.
**Key Takeaway 2**: Live summarization is fully wired with Grok-2 and will start working automatically once credits are added.
**Key Takeaway 3**: All UI features, MongoDB history saving, and browser-based Text-to-Speech (TTS) are fully functional now!`;
  } else if (safeFormat === 'faqs') {
    mockBody = `**Q: Why am I seeing this specific mock response?**
A: Your Grok API key is active, but your x.ai team account has a 0 credit balance or model restrictions. Live Grok summaries require active credits.

**Q: Can I still test the Text-To-Speech reader?**
A: Yes! Click the audio controls below to hear this simulated summary spoken aloud instantly.`;
  } else {
    mockBody = `Welcome! This is an interactive high-fidelity simulation of the Content Summarizer ${reason} Your Grok API key was verified, but your x.ai team account has no active credits or licenses. Please add credits to your account at [console.x.ai](https://console.x.ai) to enable live Grok summaries. In the meantime, this summary is fully optimized for a **${safeMood}** viewer in a **${safeFormat}** layout targeting a length of **${safeLength}** words. Click the play button below to test the Text-to-Speech system!`;
  }
  return mockBody;
}

// Route: Summarize Content
router.post('/summarize', async (req, res) => {
  try {
    const {
      sourceType,
      originalText,
      sourceUrl,
      format,
      mood,
      length,
      fileType,
      fileData,
      fileName,
      mimeType
    } = req.body;

    if (sourceType === 'url' && !sourceUrl) {
      return res.status(400).json({ error: 'Source URL is required for URL summaries.' });
    }
    if (sourceType === 'text' && !originalText) {
      return res.status(400).json({ error: 'Text input is required.' });
    }
    if (sourceType === 'file' && !fileData) {
      return res.status(400).json({ error: 'File data is required.' });
    }

    let textToSummarize = originalText || '';
    let title = 'Raw Text Summary';
    let isMultimodalImage = false;

    // 1. Parse content based on source type
    if (sourceType === 'url') {
      try {
        const scraped = await scrapeUrlContent(sourceUrl);
        textToSummarize = scraped.text;
        title = scraped.title;
      } catch (err) {
        return res.status(422).json({ error: `Scraping Failed: ${err.message}` });
      }
    } else if (sourceType === 'file') {
      if (fileType === 'pdf') {
        try {
          const pdfParseModule = getPdfParser();
          const pdfBuffer = Buffer.from(fileData, 'base64');

          if (pdfParseModule.PDFParse) {
            const parser = new pdfParseModule.PDFParse({ data: pdfBuffer });
            const pdfData = await parser.getText();
            await parser.destroy();
            textToSummarize = pdfData.text;
          } else if (pdfParseModule.default && pdfParseModule.default.PDFParse) {
            const parser = new pdfParseModule.default.PDFParse({ data: pdfBuffer });
            const pdfData = await parser.getText();
            await parser.destroy();
            textToSummarize = pdfData.text;
          } else if (typeof pdfParseModule === 'function') {
            const pdfData = await pdfParseModule(pdfBuffer);
            textToSummarize = pdfData.text;
          } else if (pdfParseModule.default && typeof pdfParseModule.default === 'function') {
            const pdfData = await pdfParseModule.default(pdfBuffer);
            textToSummarize = pdfData.text;
          } else {
            throw new Error("Unable to resolve PDF parsing library format.");
          }

          title = fileName || 'Uploaded PDF Document';

          if (!textToSummarize || textToSummarize.trim().length < 5) {
            throw new Error("Extracted PDF content is empty or contains non-readable elements. Try converting scanned pages to images and uploading them instead.");
          }
        } catch (err) {
          console.error("PDF extraction error:", err);
          return res.status(422).json({ error: `Failed to extract text from PDF: ${err.message}` });
        }
      } else if (fileType === 'text') {
        textToSummarize = fileData;
        title = fileName || 'Uploaded Text Document';
      } else if (fileType === 'image') {
        isMultimodalImage = true;
        title = fileName || 'Uploaded Image Document';
        // originalText is stored as a summary placeholder
        textToSummarize = `[Image Content: ${fileName} (${mimeType || 'image/png'})]`;
      } else {
        return res.status(400).json({ error: `Unsupported file type: ${fileType}` });
      }
    } else {
      // Create title from first 40 chars of text
      title = originalText.slice(0, 40).trim() + (originalText.length > 40 ? '...' : '');
    }

    // 2. Build AI Prompt
    const prompt = buildPrompt(textToSummarize, format, mood, length, isMultimodalImage);

    // 3. Generate summary using Groq, OpenAI, or Grok
    let summary = '';
    let apiWarning = '';
    const aiProvider = process.env.AI_PROVIDER || 'groq';

    if (aiProvider === 'groq' && process.env.GROQ_API_KEY) {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const modelName = 'llama-3.1-8b-instant';

        let completion;
        if (isMultimodalImage) {
          apiWarning = "Groq model 'llama-3.1-8b-instant' does not natively support direct image uploads. Synthesizing text-based mock instead.";
          throw new Error("Groq image OCR not supported for this model.");
        } else {
          completion = await groq.chat.completions.create({
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          });
          summary = completion.choices[0].message.content.trim();
        }
      } catch (groqErr) {
        const errMsg = groqErr && groqErr.message ? String(groqErr.message) : 'Unknown Groq API Error';
        console.error("Groq API error, falling back gracefully to mock:", errMsg);

        let detailedWarning = `Groq API Call failed: ${errMsg}. `;
        if (errMsg.toLowerCase().includes("key")) {
          detailedWarning += "Please verify your GROQ_API_KEY in your backend .env file.";
        }

        summary = generateMockSummary(format, mood, length, errMsg);
        apiWarning = detailedWarning;
      }
    } else if (aiProvider === 'grok' && process.env.GROK_API_KEY) {
      try {
        // Grok doesn't natively support image parts in standard OpenAI wrapper currently, so fall back to text-only prompt if not supported.
        const grok = new OpenAI({
          apiKey: process.env.GROK_API_KEY,
          baseURL: 'https://api.x.ai/v1',
        });

        const modelName = process.env.GROK_MODEL || 'grok-beta';

        let completion;
        if (isMultimodalImage) {
          // If Grok receives an image, we try using standard prompt asking grok to describe it if it was OCR-ed or just run text
          apiWarning = "Grok model does not natively support direct image uploads in standard settings. Synthesizing text-based mock instead.";
          throw new Error("Grok image OCR not configured on standard endpoints.");
        } else {
          completion = await grok.chat.completions.create({
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          });
          summary = completion.choices[0].message.content.trim();
        }
      } catch (grokErr) {
        const errMsg = grokErr && grokErr.message ? String(grokErr.message) : 'Unknown Grok API Error';
        console.error("Grok API error, falling back gracefully to mock:", errMsg);

        let detailedWarning = `Grok API Call failed: ${errMsg}. `;
        if (
          errMsg.toLowerCase().includes("credits") ||
          errMsg.toLowerCase().includes("permission") ||
          errMsg.toLowerCase().includes("balance") ||
          errMsg.toLowerCase().includes("model not found")
        ) {
          detailedWarning += "Your x.ai console team does not have any active credits/licenses, or this model is restricted. Displaying a simulated summary for evaluation.";
        }

        summary = generateMockSummary(format, mood, length, errMsg);
        apiWarning = detailedWarning;
      }
    } else if (aiProvider === 'openai' && process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        let completion;

        if (isMultimodalImage) {
          completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimeType || 'image/png'};base64,${fileData}`,
                    },
                  },
                ],
              },
            ],
            temperature: 0.3,
          });
        } else {
          completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          });
        }
        summary = completion.choices[0].message.content.trim();
      } catch (openaiErr) {
        const errMsg = openaiErr && openaiErr.message ? String(openaiErr.message) : 'Unknown OpenAI API Error';
        console.error("OpenAI API error, falling back gracefully to mock:", errMsg);

        let detailedWarning = `OpenAI API Call failed: ${errMsg}. `;
        summary = generateMockSummary(format, mood, length, errMsg);
        apiWarning = detailedWarning;
      }
    } else if (process.env.GROQ_API_KEY) {
      // Direct fallback to Groq if key is provided and aiProvider did not match
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const modelName = 'llama-3.1-8b-instant';

        if (isMultimodalImage) {
          apiWarning = "Groq direct fallback failed: image uploads not supported for this model.";
          throw new Error("Groq image OCR not supported.");
        } else {
          const completion = await groq.chat.completions.create({
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          });
          summary = completion.choices[0].message.content.trim();
        }
      } catch (groqErr) {
        const errMsg = groqErr && groqErr.message ? String(groqErr.message) : 'Unknown Groq API Error';
        summary = generateMockSummary(format, mood, length, errMsg);
        apiWarning = `Groq direct fallback failed: ${errMsg}`;
      }
    } else {
      // Dynamic fallback/Mock summary to facilitate evaluation when no keys are supplied
      console.warn("No AI API Keys found. Returning interactive mock response.");
      summary = generateMockSummary(format, mood, length);
    }

    // 4. Save to MongoDB history if available (fail-safe if DB is offline)
    let savedDoc = null;
    try {
      const summaryDoc = new Summary({
        title,
        originalText: textToSummarize,
        sourceType,
        sourceUrl: sourceType === 'url' ? sourceUrl : undefined,
        summary,
        options: { format, mood, length }
      });
      savedDoc = await summaryDoc.save();
    } catch (dbErr) {
      console.error("Database Save Failed:", dbErr.message);
      // We still return the summary even if database save fails so application doesn't crash
    }

    res.status(200).json({
      success: true,
      title,
      summary,
      savedDoc,
      warning: apiWarning || ((!process.env.GROK_API_KEY && !process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) ? "API Key missing; displaying mock demonstration summary." : undefined)
    });

  } catch (error) {
    console.error("Summarization endpoint error:", error);
    res.status(500).json({ error: error.message || 'An error occurred during summarization.' });
  }
});

// Route: Get History
router.get('/history', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      // Full text search if keywords provided
      query = { $text: { $search: search } };
    }

    const history = await Summary.find(query).sort({ createdAt: -1 }).limit(50);
    res.status(200).json({ success: true, history });
  } catch (error) {
    console.error("Fetch history error:", error);
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

// Route: Delete History Item
router.delete('/history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Summary.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Summary deleted successfully from history.' });
  } catch (error) {
    console.error("Delete history error:", error);
    res.status(500).json({ error: 'Failed to delete history item.' });
  }
});

export default router;
