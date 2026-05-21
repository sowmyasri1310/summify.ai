import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Link, 
  Sparkles, 
  BookOpen, 
  GraduationCap, 
  Search, 
  Briefcase, 
  Smile, 
  HelpCircle, 
  List, 
  Key, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Square, 
  Copy, 
  Check, 
  Trash2, 
  Menu, 
  X,
  Compass,
  AlertTriangle,
  UploadCloud
} from 'lucide-react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

// Helper to clean Markdown tags for readable Speech Synthesis
const cleanMarkdownForSpeech = (text) => {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // remove bold asterisks
    .replace(/\* /g, '• ')             // bullets
    .replace(/###/g, '')               // remove headings
    .replace(/##/g, '')
    .replace(/#/g, '')
    .replace(/_/g, '')                 // remove italics
    .replace(/\bQ:\s*/gi, 'Question: ')
    .replace(/\bA:\s*/gi, 'Answer: ')
    .replace(/`([^`]+)`/g, '$1')       // remove code blocks
    .trim();
};

function App() {
  // Input parameters
  const [sourceType, setSourceType] = useState('text');
  const [originalText, setOriginalText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [mood, setMood] = useState('beginner');
  const [customMood, setCustomMood] = useState('');
  const [format, setFormat] = useState('simple');
  const [length, setLength] = useState('100'); // '10', '50', '100', 'detailed'

  // File Upload states
  const [fileObject, setFileObject] = useState(null);
  const [fileType, setFileType] = useState(''); // 'pdf', 'image', 'text'
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
  const [fileTextContent, setFileTextContent] = useState('');
  const [fileBase64, setFileBase64] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Summary generation states
  const [summary, setSummary] = useState('');
  const [summaryTitle, setSummaryTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [copied, setCopied] = useState(false);

  // History & Sidebar
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Speech Synthesis States
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [speechRate, setSpeechRate] = useState(1);

  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef(null);

  // Load history & setup voice lists on mount
  useEffect(() => {
    fetchHistory();
    setupSpeechVoices();
    if (synthRef.current) {
      synthRef.current.onvoiceschanged = setupSpeechVoices;
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Set up voices for TTS
  const setupSpeechVoices = () => {
    if (!synthRef.current) return;
    const allVoices = synthRef.current.getVoices();
    setVoices(allVoices);
    
    // Default to a premium sounding English voice if available
    const defaultVoice = allVoices.find(v => v.name.includes('Google US English') || v.name.includes('Natural')) || allVoices.find(v => v.lang.startsWith('en')) || allVoices[0];
    if (defaultVoice) {
      setSelectedVoiceName(defaultVoice.name);
    }
  };

  // Fetch past summaries from MongoDB backend
  const fetchHistory = async (searchVal = '') => {
    try {
      const url = searchVal ? `${API_BASE}/history?search=${encodeURIComponent(searchVal)}` : `${API_BASE}/history`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  // Handle live history search input
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchHistory(val);
  };

  // Delete history item
  const deleteHistoryItem = async (e, id) => {
    e.stopPropagation(); // prevent clicking the item
    try {
      const res = await fetch(`${API_BASE}/history/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (selectedHistoryId === id) {
          setSelectedHistoryId(null);
          setSummary('');
          setSummaryTitle('');
          stopSpeech();
        }
        fetchHistory(searchQuery);
      }
    } catch (err) {
      console.error('Error deleting history:', err);
    }
  };

  // Click history item to reload it
  const loadHistoryItem = (item) => {
    setSelectedHistoryId(item._id);
    setSummary(item.summary);
    setSummaryTitle(item.title);
    setSourceType(item.sourceType);
    if (item.sourceType === 'url') {
      setSourceUrl(item.sourceUrl || '');
      setOriginalText('');
    } else if (item.sourceType === 'file') {
      setOriginalText(item.originalText || '');
      setSourceUrl('');
    } else {
      setOriginalText(item.originalText || '');
      setSourceUrl('');
    }
    setMood(item.options?.mood || 'beginner');
    setFormat(item.options?.format || 'simple');
    setLength(item.options?.length || '100');
    setError('');
    setWarning('');
    stopSpeech();
    
    // Reset file inputs because we are viewing a historic record
    setFileObject(null);
    setFileType('');
    setFileName('');
    setFileSize('');
    setMimeType('');
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setFilePreviewUrl('');
    setFileTextContent('');
    setFileBase64('');

    // Close sidebar on mobile
    setIsSidebarOpen(false);
  };

  // Reset inputs for a new summary
  const handleResetInputs = () => {
    setSelectedHistoryId(null);
    setSummary('');
    setSummaryTitle('');
    setOriginalText('');
    setSourceUrl('');
    setError('');
    setWarning('');
    stopSpeech();
    
    // Reset file states
    setFileObject(null);
    setFileType('');
    setFileName('');
    setFileSize('');
    setMimeType('');
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setFilePreviewUrl('');
    setFileTextContent('');
    setFileBase64('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Helper to format file sizes
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Handle manual file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Extract text or base64 and validate file type/size
  const processSelectedFile = (file) => {
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Please upload a file smaller than 10MB.');
      return;
    }

    setError('');
    setWarning('');

    const name = file.name;
    const ext = name.split('.').pop().toLowerCase();
    let type = '';

    if (ext === 'pdf') {
      type = 'pdf';
    } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      type = 'image';
    } else if (['txt', 'md', 'json', 'csv', 'log', 'ini'].includes(ext)) {
      type = 'text';
    } else {
      setError('Unsupported file type. Please upload a PDF, image (PNG, JPG, WEBP), or plain text file (.txt, .md).');
      return;
    }

    setFileObject(file);
    setFileType(type);
    setFileName(name);
    setFileSize(formatBytes(file.size));
    setMimeType(file.type || `application/${ext}`);

    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    if (type === 'image') {
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl('');
    }

    const reader = new FileReader();

    if (type === 'text') {
      reader.onload = (event) => {
        setFileTextContent(event.target.result);
        setFileBase64('');
      };
      reader.readAsText(file);
    } else {
      reader.onload = (event) => {
        const base64String = event.target.result.split(',')[1];
        setFileBase64(base64String);
        setFileTextContent('');
      };
      reader.readAsDataURL(file);
    }
  };

  // Drag and drop event handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Remove the currently uploaded file
  const removeSelectedFile = (e) => {
    if (e) e.stopPropagation();
    setFileObject(null);
    setFileType('');
    setFileName('');
    setFileSize('');
    setMimeType('');
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setFilePreviewUrl('');
    setFileTextContent('');
    setFileBase64('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit Summarize request
  const handleSummarize = async () => {
    setIsLoading(true);
    setError('');
    setWarning('');
    setSummary('');
    stopSpeech();

    const selectedMood = mood === 'custom' ? customMood : mood;

    let payload = {
      sourceType,
      format,
      mood: selectedMood || 'beginner',
      length,
    };

    if (sourceType === 'text') {
      payload.originalText = originalText;
    } else if (sourceType === 'url') {
      payload.sourceUrl = sourceUrl;
    } else if (sourceType === 'file') {
      if (!fileObject) {
        setError('Please select or drop a file/image first.');
        setIsLoading(false);
        return;
      }
      payload.fileType = fileType;
      payload.fileName = fileName;
      payload.mimeType = mimeType;
      payload.fileData = fileType === 'text' ? fileTextContent : fileBase64;
    }

    try {
      const res = await fetch(`${API_BASE}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Server returned an error');
      }

      if (data.success) {
        setSummary(data.summary);
        setSummaryTitle(data.title);
        if (data.warning) {
          setWarning(data.warning);
        }
        // Refresh history to show the newly saved summary
        fetchHistory(searchQuery);
        if (data.savedDoc) {
          setSelectedHistoryId(data.savedDoc._id);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // TEXT-TO-SPEECH CONTROLS
  const startSpeech = () => {
    if (!synthRef.current || !summary) return;

    if (isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
      setIsSpeaking(true);
      return;
    }

    synthRef.current.cancel(); // Stop any current speech

    const cleanText = cleanMarkdownForSpeech(summary);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Apply selected voice
    if (selectedVoiceName) {
      const voice = voices.find(v => v.name === selectedVoiceName);
      if (voice) utterance.voice = voice;
    }

    utterance.rate = speechRate;

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = (e) => {
      console.error('Speech synthesis error:', e);
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    setIsSpeaking(true);
    setIsPaused(false);
    synthRef.current.speak(utterance);
  };

  const pauseSpeech = () => {
    if (!synthRef.current) return;
    synthRef.current.pause();
    setIsPaused(true);
    setIsSpeaking(false);
  };

  const stopSpeech = () => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  // Handle speech rate change on the fly (re-speaks if already playing)
  const handleRateChange = (e) => {
    const rate = parseFloat(e.target.value);
    setSpeechRate(rate);
    if (isSpeaking || isPaused) {
      setTimeout(() => {
        startSpeech();
      }, 50);
    }
  };

  const handleVoiceChange = (e) => {
    setSelectedVoiceName(e.target.value);
    if (isSpeaking || isPaused) {
      setTimeout(() => {
        startSpeech();
      }, 50);
    }
  };

  // Convert simple markdown list tags and newlines to HTML
  const formatSummaryHTML = (md) => {
    if (!md) return '';
    return md
      .split('\n')
      .map((line, index) => {
        // Bullet points
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
          const content = line.trim().replace(/^[\*\-]\s+/, '');
          return `<li key=${index}>${replaceBold(content)}</li>`;
        }
        // FAQ Q&A bold tags
        if (line.trim().startsWith('**Q:')) {
          return `<p style="margin-top: 1rem; color: #6366f1; font-weight: 700;">${replaceBold(line)}</p>`;
        }
        if (line.trim().startsWith('**A:')) {
          return `<p style="margin-bottom: 1rem; padding-left: 0.5rem; border-left: 2px solid rgba(255,255,255,0.15);">${replaceBold(line)}</p>`;
        }
        // Headings
        if (line.trim().startsWith('###')) {
          return `<h4 style="margin: 1rem 0 0.5rem; color: white;">${line.replace('###', '').trim()}</h4>`;
        }
        // General text with bold replacement
        return line.trim() ? `<p>${replaceBold(line)}</p>` : '';
      })
      .join('');
  };

  const replaceBold = (text) => {
    return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  };

  return (
    <div className="app-container">
      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 9,
          }}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR: History list & Searching */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Sparkles width={20} height={20} />
            <span>Summify.AI</span>
          </div>
          <button 
            className="action-icon-btn" 
            style={{ marginLeft: 'auto', display: 'flex' }}
            onClick={handleResetInputs}
            title="New Summary"
          >
            <PlusIcon width={16} height={16} />
          </button>
          <button 
            className="action-icon-btn" 
            style={{ display: 'none' }} // managed by responsive media queries
            onClick={() => setIsSidebarOpen(false)}
          >
            <X width={16} height={16} />
          </button>
        </div>

        <div className="sidebar-search">
          <Search className="sidebar-search-icon" />
          <input 
            type="text" 
            placeholder="Search past summaries..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        <div className="sidebar-list">
          {history.length > 0 ? (
            history.map((item) => (
              <div 
                key={item._id} 
                className={`history-item ${selectedHistoryId === item._id ? 'active' : ''}`}
                onClick={() => loadHistoryItem(item)}
              >
                <div className="history-item-details">
                  <div className="history-item-title">{item.title}</div>
                  <div className="history-item-meta">
                    <span>{item.sourceType.toUpperCase()}</span>
                    <span>•</span>
                    <span>{item.options?.mood}</span>
                  </div>
                </div>
                <button 
                  className="delete-history-btn"
                  onClick={(e) => deleteHistoryItem(e, item._id)}
                  title="Delete from history"
                >
                  <Trash2 width={14} height={14} />
                </button>
              </div>
            ))
          ) : (
            <div className="no-history">
              No saved history. Generate a summary to start logging!
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        <div className="app-title-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="menu-toggle" onClick={() => setIsSidebarOpen(true)}>
              <Menu width={20} height={20} />
            </button>
            <h1>AI Content Summarizer</h1>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Empowered by AI Intelligence
          </div>
        </div>

        {/* INPUT CARD */}
        <section className="glass-panel input-card">
          <div className="tabs-container">
            <button 
              className={`tab-btn ${sourceType === 'text' ? 'active' : ''}`}
              onClick={() => setSourceType('text')}
            >
              <FileText width={16} height={16} />
              Raw Text / Notes
            </button>
            <button 
              className={`tab-btn ${sourceType === 'url' ? 'active' : ''}`}
              onClick={() => setSourceType('url')}
            >
              <Link width={16} height={16} />
              Article / Blog Link
            </button>
            <button 
              className={`tab-btn ${sourceType === 'file' ? 'active' : ''}`}
              onClick={() => setSourceType('file')}
            >
              <UploadCloud width={16} height={16} />
              Upload File / Image
            </button>
          </div>

          {sourceType === 'text' ? (
            <div className="textarea-container">
              <textarea 
                className="text-input" 
                placeholder="Paste your long notes, meeting logs, transcripts, or paragraphs here..."
                value={originalText}
                onChange={(e) => setOriginalText(e.target.value)}
              />
              <div className="word-counter">
                {originalText.split(/\s+/).filter(Boolean).length} words | {originalText.length} characters
              </div>
            </div>
          ) : sourceType === 'url' ? (
            <div className="url-input-container">
              <div className="url-input-wrapper">
                <Link className="url-input-icon" />
                <input 
                  type="url" 
                  className="url-input" 
                  placeholder="https://example.com/blog-post-url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                Note: Our secure backend will scrape the text elements directly from the website and analyze them.
              </p>
            </div>
          ) : (
            <div className="file-input-container" style={{ animation: 'fadeIn 0.3s ease' }}>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                style={{ display: 'none' }}
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md"
              />
              
              {!fileObject ? (
                <div 
                  className={`dropzone ${isDragActive ? 'active' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="dropzone-icon" />
                  <div className="dropzone-text-container">
                    <span className="dropzone-main-text">Drag & drop your file here, or click to browse</span>
                    <span className="dropzone-sub-text">Supports PDF, images (PNG, JPG, WEBP), and plain text (.txt, .md)</span>
                    <span className="dropzone-sub-text" style={{ fontSize: '0.75rem', opacity: 0.8 }}>Maximum size: 10MB</span>
                  </div>
                </div>
              ) : (
                <div className="file-preview-card">
                  <div className="file-info-block">
                    {fileType === 'image' ? (
                      <img 
                        src={filePreviewUrl} 
                        alt="Preview" 
                        className="file-preview-thumbnail"
                      />
                    ) : (
                      <div className="file-icon-wrapper">
                        <FileText width={22} height={22} />
                      </div>
                    )}
                    <div className="file-details">
                      <span className="file-name">{fileName}</span>
                      <div className="file-meta-row">
                        <span className="file-badge">{fileType}</span>
                        <span>•</span>
                        <span>{fileSize}</span>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    className="trash-action-btn"
                    onClick={removeSelectedFile}
                    title="Remove File"
                  >
                    <Trash2 width={18} height={18} />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* CONTROLS CARD */}
        <section className="glass-panel controls-card">
          {/* 1. Mood Personas Selection */}
          <div>
            <div className="section-label">
              <Compass width={16} height={16} />
              Mood & Persona Style
            </div>
            <div className="mood-grid">
              <button 
                className={`mood-btn ${mood === 'beginner' ? 'active' : ''}`}
                onClick={() => setMood('beginner')}
              >
                <Smile />
                <span>Beginner</span>
              </button>
              <button 
                className={`mood-btn ${mood === 'student' ? 'active' : ''}`}
                onClick={() => setMood('student')}
              >
                <GraduationCap />
                <span>Student</span>
              </button>
              <button 
                className={`mood-btn ${mood === 'researcher' ? 'active' : ''}`}
                onClick={() => setMood('researcher')}
              >
                <BookOpen />
                <span>Researcher</span>
              </button>
              <button 
                className={`mood-btn ${mood === 'ceo' ? 'active' : ''}`}
                onClick={() => setMood('ceo')}
              >
                <Briefcase />
                <span>CEO</span>
              </button>
              <button 
                className={`mood-btn ${mood === 'child' ? 'active' : ''}`}
                onClick={() => setMood('child')}
              >
                <HelpCircle />
                <span>Child</span>
              </button>
              <button 
                className={`mood-btn ${mood === 'custom' ? 'active' : ''}`}
                onClick={() => setMood('custom')}
              >
                <Sparkles />
                <span>Custom...</span>
              </button>
            </div>

            {mood === 'custom' && (
              <div className="custom-prompt-container" style={{ marginTop: '1rem' }}>
                <input 
                  type="text" 
                  className="custom-prompt-input"
                  placeholder="e.g., UPSC preparation, Technical Architect, 10-year-old..."
                  value={customMood}
                  onChange={(e) => setCustomMood(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* 2. Format Selection */}
          <div>
            <div className="section-label">
              <List width={16} height={16} />
              Output Structure
            </div>
            <div className="format-grid">
              <div 
                className={`format-card ${format === 'simple' ? 'active' : ''}`}
                onClick={() => setFormat('simple')}
              >
                <div className="format-card-icon"><FileText width={16} height={16} /></div>
                <div className="format-card-info">
                  <div className="format-card-title">Narrative</div>
                  <div className="format-card-desc">Cohesive paragraph outline</div>
                </div>
              </div>

              <div 
                className={`format-card ${format === 'bullets' ? 'active' : ''}`}
                onClick={() => setFormat('bullets')}
              >
                <div className="format-card-icon"><List width={16} height={16} /></div>
                <div className="format-card-info">
                  <div className="format-card-title">Bullet Points</div>
                  <div className="format-card-desc">Detailed points review</div>
                </div>
              </div>

              <div 
                className={`format-card ${format === 'takeaways' ? 'active' : ''}`}
                onClick={() => setFormat('takeaways')}
              >
                <div className="format-card-icon"><Sparkles width={16} height={16} /></div>
                <div className="format-card-info">
                  <div className="format-card-title">Key Takeaways</div>
                  <div className="format-card-desc">High-impact points list</div>
                </div>
              </div>

              <div 
                className={`format-card ${format === 'faqs' ? 'active' : ''}`}
                onClick={() => setFormat('faqs')}
              >
                <div className="format-card-icon"><HelpCircle width={16} height={16} /></div>
                <div className="format-card-info">
                  <div className="format-card-title">Q&A FAQs</div>
                  <div className="format-card-desc">Interactive Q&A pairs</div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Length Slider (TL;DR) */}
          <div className="slider-container">
            <div className="section-label">
              <Compass width={16} height={16} />
              Too Long Didn't Read (Length Control)
            </div>
            <input 
              type="range" 
              min="1" 
              max="4" 
              step="1"
              value={length === '10' ? '1' : length === '50' ? '2' : length === '100' ? '3' : '4'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '1') setLength('10');
                else if (val === '2') setLength('50');
                else if (val === '3') setLength('100');
                else setLength('detailed');
              }}
              className="range-slider"
            />
            <div className="slider-labels">
              <span 
                className={`slider-label-item ${length === '10' ? 'active' : ''}`}
                onClick={() => setLength('10')}
              >
                10 words (TL;DR)
              </span>
              <span 
                className={`slider-label-item ${length === '50' ? 'active' : ''}`}
                onClick={() => setLength('50')}
              >
                50 words
              </span>
              <span 
                className={`slider-label-item ${length === '100' ? 'active' : ''}`}
                onClick={() => setLength('100')}
              >
                100 words
              </span>
              <span 
                className={`slider-label-item ${length === 'detailed' ? 'active' : ''}`}
                onClick={() => setLength('detailed')}
              >
                Detailed Outline
              </span>
            </div>
          </div>

          <button 
            className={`summarize-btn ${isLoading ? 'glowing-btn-loading' : ''}`}
            onClick={handleSummarize}
            disabled={
              isLoading || 
              (sourceType === 'text' && !originalText) || 
              (sourceType === 'url' && !sourceUrl) ||
              (sourceType === 'file' && !fileObject)
            }
          >
            {isLoading ? (
              <>
                <div className="spinner" />
                <span>Reading & Summarizing...</span>
              </>
            ) : (
              <>
                <Sparkles width={18} height={18} />
                <span>Generate Smart Summary</span>
              </>
            )}
          </button>
        </section>

        {/* ERROR STATE */}
        {error && (
          <div 
            className="glass-panel" 
            style={{
              padding: '1rem 1.5rem',
              borderColor: '#ef4444',
              background: 'rgba(239,68,68,0.05)',
              color: '#fca5a5',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <AlertTriangle width={18} height={18} style={{ color: '#ef4444' }} />
            <div>{error}</div>
          </div>
        )}

        {/* SUMMARY RESULT CARD */}
        {summary && (
          <section className={`glass-panel result-card ${warning ? 'mock-warning' : ''}`}>
            <div className="result-header">
              <div className="result-header-title">
                <Sparkles width={18} height={18} style={{ color: 'var(--accent-indigo)' }} />
                <span>{summaryTitle || 'Generated Summary'}</span>
              </div>
              <div className="result-actions">
                <button 
                  className={`action-icon-btn ${copied ? 'active' : ''}`}
                  onClick={copyToClipboard}
                  title="Copy Summary"
                >
                  {copied ? <Check width={16} height={16} /> : <Copy width={16} height={16} />}
                </button>
              </div>
            </div>

            {warning && (
              <div className="mock-banner">
                <AlertTriangle width={16} height={16} />
                <span>{warning}</span>
              </div>
            )}

            <div className="summary-content">
              {format === 'bullets' ? (
                <ul dangerouslySetInnerHTML={{ __html: formatSummaryHTML(summary) }} />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: formatSummaryHTML(summary) }} />
              )}
            </div>

            {/* TEXT-TO-SPEECH AUDIO CONTROLLER WIDGET */}
            <div className="tts-panel">
              <div className="section-label" style={{ marginBottom: 0 }}>
                <Volume2 width={16} height={16} />
                Audio Text-To-Speech Reader
              </div>

              <div className="tts-controls-row">
                <button 
                  className={`action-icon-btn ${isSpeaking ? 'active' : ''}`}
                  onClick={isSpeaking ? pauseSpeech : startSpeech}
                  title={isSpeaking ? "Pause Speech" : isPaused ? "Resume Speech" : "Play Speech"}
                >
                  {isSpeaking ? <Pause width={16} height={16} /> : <Play width={16} height={16} />}
                </button>

                {(isSpeaking || isPaused) && (
                  <button 
                    className="action-icon-btn"
                    onClick={stopSpeech}
                    title="Stop Speech"
                  >
                    <Square width={16} height={16} />
                  </button>
                )}

                {/* Voice selection dropdown */}
                {voices.length > 0 && (
                  <select 
                    className="voice-select" 
                    value={selectedVoiceName} 
                    onChange={handleVoiceChange}
                  >
                    {voices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                )}

                {/* Speech rate controller */}
                <div className="speed-control">
                  <span>Speed:</span>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2" 
                    step="0.1" 
                    value={speechRate}
                    onChange={handleRateChange}
                    className="speed-slider"
                  />
                  <span>{speechRate}x</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// Simple PlusIcon definition to avoid missing imports
function PlusIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

export default App;
