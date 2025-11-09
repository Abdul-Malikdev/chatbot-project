import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Paperclip, X, ChevronLeft, ChevronRight, FileText, ExternalLink, Trash2, MessageSquare, Download, ThumbsUp, ThumbsDown, Mic, Volume2, Camera, Settings, Moon, Sun, Languages, Search, Pin, Share2 } from 'lucide-react';

const ChatWidget = () => {
  const [messages, setMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const [showHistory, setShowHistory] = useState(window.innerWidth > 768);
  const [selectedFile, setSelectedFile] = useState(null);
  const [databaseId, setDatabaseId] = useState('');
  const [showAllSources, setShowAllSources] = useState({});
  const [responseTone, setResponseTone] = useState('balanced');
  const [showSettings, setShowSettings] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [language, setLanguage] = useState('en');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [botName, setBotName] = useState('AI Assistant');
  const [botAvatar, setBotAvatar] = useState('🤖');
  const [previewFile, setPreviewFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const API_BASE = 'http://localhost:3000/api';
  const languages = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', zh: 'Chinese', ar: 'Arabic', ur: 'Urdu' };
  const toneInstructions = {
    simple: "Keep answers short and simple.",
    balanced: "Provide clear, balanced answers.",
    detailed: "Give comprehensive, detailed answers.",
    professional: "Use formal, professional language."
  };

  useEffect(() => {
    initConversation();
    setupSpeechRecognition();
    loadSettings();
    const handleResize = () => { if (window.innerWidth <= 768) setShowHistory(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      const userMessages = messages.filter(m => m.role === 'user');
      if (userMessages.length > 0) {
        setChatHistory(prev => {
          const newHistory = [...prev];
          const lastMessage = userMessages[userMessages.length - 1];
          if (!newHistory.some(h => h.id === lastMessage.id)) {
            newHistory.push({ id: lastMessage.id, content: lastMessage.content, timestamp: lastMessage.timestamp, conversationId });
          }
          return newHistory.slice(-20);
        });
      }
    }
  }, [messages, conversationId]);

  const loadSettings = () => {
    setTheme(localStorage.getItem('chatbot-theme') || 'dark');
    setLanguage(localStorage.getItem('chatbot-language') || 'en');
    setBotName(localStorage.getItem('chatbot-name') || 'AI Assistant');
    setBotAvatar(localStorage.getItem('chatbot-avatar') || '🤖');
  };

  useEffect(() => {
    localStorage.setItem('chatbot-theme', theme);
    localStorage.setItem('chatbot-language', language);
    localStorage.setItem('chatbot-name', botName);
    localStorage.setItem('chatbot-avatar', botAvatar);
  }, [theme, language, botName, botAvatar]);

  const setupSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.onresult = (event) => {
        setInputMessage(event.results[0][0].transcript);
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  };

  const initConversation = async () => {
    try {
      const response = await fetch(`${API_BASE}/chat/conversation/new`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await response.json();
      setConversationId(data.conversationId);
    } catch (error) { console.error('Failed to initialize:', error); }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    const userMessage = inputMessage.trim();
    setInputMessage('');
    const newUserMessage = { id: Date.now(), role: 'user', content: userMessage, timestamp: new Date().toISOString(), pinned: false };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);
    setIsTyping(true);

    try {
      const toneInstruction = toneInstructions[responseTone];
      const languageInstruction = language !== 'en' ? `Respond in ${languages[language]}. ` : '';
      const finalMessage = `${languageInstruction}${toneInstruction}\n\nUser question: ${userMessage}`;
      
      const response = await fetch(`${API_BASE}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: finalMessage, conversationId, databaseId: databaseId || undefined, includeHistory: true })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setIsTyping(false);
      
      const aiMessage = { id: Date.now() + 1, role: 'assistant', content: data.response, sources: data.sources || [], timestamp: data.timestamp, feedback: null, pinned: false };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Send error:', error);
      setIsTyping(false);
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: '❌ Connection error. Check backend.', timestamp: new Date().toISOString(), pinned: false }]);
    } finally { setIsLoading(false); }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreviewFile({ type: 'image', url: e.target.result, name: file.name });
        reader.readAsDataURL(file);
      } else {
        setPreviewFile({ type: 'document', name: file.name, size: file.size });
      }
      uploadFile(file);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: '[Image Analysis]', image: event.target.result, timestamp: new Date().toISOString(), pinned: false }]);
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: `🖼️ Image received: ${file.type}\nSize: ${(file.size/1024).toFixed(2)}KB\n\nFor AI vision analysis, integrate GPT-4 Vision or Google Cloud Vision API.`, timestamp: new Date().toISOString(), pinned: false }]);
        }, 1500);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    if (databaseId) formData.append('databaseId', databaseId);

    setMessages(prev => [...prev, { id: Date.now(), role: 'system', content: `📤 Processing ${file.name}...`, timestamp: new Date().toISOString(), pinned: false }]);

    try {
      const response = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      const data = await response.json();
      
      if (data.success) {
        setDatabaseId(data.fileId);
        setMessages(prev => [...prev.slice(0, -1), { id: Date.now() + 1, role: 'system', content: `✅ ${file.name} processed!\n📊 ${data.documentsCount} chunks indexed`, timestamp: new Date().toISOString(), pinned: false }]);
      } else throw new Error(data.error || 'Upload failed');
    } catch (error) {
      setMessages(prev => [...prev.slice(0, -1), { id: Date.now() + 1, role: 'system', content: `❌ Upload failed: ${error.message}`, timestamp: new Date().toISOString(), pinned: false }]);
    }
  };

  const handleKeyPress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const clearChat = () => { setMessages([]); setDatabaseId(''); setSelectedFile(null); setPreviewFile(null); initConversation(); };
  const toggleSources = (messageId) => setShowAllSources(prev => ({ ...prev, [messageId]: !prev[messageId] }));
  const exportChat = () => {
    const chatText = messages.map(msg => `[${new Date(msg.timestamp).toLocaleString()}] ${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n');
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleFeedback = (messageId, feedback) => setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, feedback } : msg));
  const togglePin = (messageId) => setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, pinned: !msg.pinned } : msg));
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };
  const startListening = () => { if (recognitionRef.current) { setIsListening(true); recognitionRef.current.start(); } };
  const shareConversation = () => { navigator.clipboard.writeText(window.location.href); alert('Share link copied! 🔗'); };

  const filteredMessages = messages.filter(msg => !searchQuery || msg.content.toLowerCase().includes(searchQuery.toLowerCase()));
  const themeColors = theme === 'dark' ? 'from-slate-900 via-purple-900 to-slate-900' : 'from-slate-50 via-purple-50 to-slate-50';
  const bgColor = theme === 'dark' ? 'bg-slate-800/80' : 'bg-white/95';
  const textColor = theme === 'dark' ? 'text-white' : 'text-slate-900';
  const secondaryText = theme === 'dark' ? 'text-gray-300' : 'text-gray-700';
  const inputBg = theme === 'dark' ? 'bg-slate-700/50 text-white' : 'bg-gray-100 text-gray-900';
  const messageBg = theme === 'dark' ? 'bg-slate-700' : 'bg-white shadow-md border border-gray-200';
  const pinnedCount = messages.filter(m => m.pinned).length;

  return (
    <div className={`flex h-screen bg-gradient-to-br ${themeColors}`}>
      {/* History Sidebar */}
      <div className={`${showHistory ? 'w-64' : 'w-0'} transition-all duration-300 ${bgColor} backdrop-blur-sm border-r ${theme === 'dark' ? 'border-purple-500/30' : 'border-gray-200'} overflow-hidden flex-col hidden md:flex`}>
        <div className={`p-4 border-b ${theme === 'dark' ? 'border-purple-500/30' : 'border-gray-200'} flex items-center justify-between`}>
          <h3 className={`${secondaryText} font-semibold flex items-center gap-2 text-sm`}><MessageSquare className="w-4 h-4" />History</h3>
          {chatHistory.length > 0 && <button onClick={() => setChatHistory([])} className="p-1 hover:bg-red-500/20 rounded transition"><Trash2 className="w-3 h-3 text-red-400" /></button>}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {chatHistory.map((item) => (
            <div key={item.id} className={`p-2 ${theme === 'dark' ? 'bg-slate-700/50 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200'} rounded-lg cursor-pointer transition`}>
              <p className={`text-xs ${secondaryText} line-clamp-2`}>{item.content}</p>
              <span className="text-xs text-gray-500 mt-1 block">{new Date(item.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Main Chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className={`${bgColor} backdrop-blur-sm border-b ${theme === 'dark' ? 'border-purple-500/30' : 'border-gray-200'} p-3 md:p-4`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button onClick={() => setShowHistory(!showHistory)} className="p-2 hover:bg-purple-500/20 rounded-lg transition hidden md:block">
                {showHistory ? <ChevronLeft className="w-4 h-4 text-purple-400" /> : <ChevronRight className="w-4 h-4 text-purple-400" />}
              </button>
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg text-xl flex-shrink-0">{botAvatar}</div>
              <div className="min-w-0 flex-1">
                <h2 className={`text-base md:text-lg font-bold ${textColor} truncate`}>{botName}</h2>
                <p className={`text-xs ${theme === 'dark' ? 'text-purple-300' : 'text-purple-600'}`}>Powered by Groq</p>
              </div>
            </div>
            <div className="flex gap-1 md:gap-2 items-center flex-shrink-0">
              {databaseId && <div className="hidden sm:flex px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs items-center gap-1"><FileText className="w-3 h-3" /><span className="hidden md:inline">File</span></div>}
              {pinnedCount > 0 && <div className="hidden sm:flex px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs items-center gap-1"><Pin className="w-3 h-3" />{pinnedCount}</div>}
              <button onClick={() => setShowSearch(!showSearch)} className="p-2 hover:bg-purple-500/20 rounded-lg transition" title="Search"><Search className={`w-4 h-4 ${theme === 'dark' ? 'text-purple-300' : 'text-purple-600'}`} /></button>
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 hover:bg-purple-500/20 rounded-lg transition" title="Theme">{theme === 'dark' ? <Sun className="w-4 h-4 text-purple-300" /> : <Moon className="w-4 h-4 text-purple-600" />}</button>
              <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-purple-500/20 rounded-lg transition" title="Settings"><Settings className={`w-4 h-4 ${theme === 'dark' ? 'text-purple-300' : 'text-purple-600'}`} /></button>
              <button onClick={shareConversation} className="hidden sm:block p-2 hover:bg-purple-500/20 rounded-lg transition" title="Share"><Share2 className={`w-4 h-4 ${theme === 'dark' ? 'text-purple-300' : 'text-purple-600'}`} /></button>
              <button onClick={exportChat} disabled={messages.length === 0} className="hidden sm:block p-2 hover:bg-purple-500/20 rounded-lg transition disabled:opacity-50" title="Export"><Download className={`w-4 h-4 ${theme === 'dark' ? 'text-purple-300' : 'text-purple-600'}`} /></button>
              <button onClick={clearChat} className={`px-3 py-2 text-sm ${theme === 'dark' ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300' : 'bg-purple-500 hover:bg-purple-600 text-white'} rounded-lg transition`}>Clear</button>
            </div>
          </div>
          {showSearch && (
            <div className="mt-3">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search messages..." className={`w-full px-4 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-white text-gray-900 border border-gray-200'} focus:outline-none focus:ring-2 focus:ring-purple-500`} />
            </div>
          )}

          {showSettings && (
            <div className={`mt-3 p-3 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'} rounded-lg space-y-3`}>
              <div>
                <h3 className={`${textColor} font-semibold mb-2 text-sm`}>Response Tone</h3>
                <div className="flex gap-2 flex-wrap">
                  {['simple', 'balanced', 'detailed', 'professional'].map(tone => (
                    <button key={tone} onClick={() => setResponseTone(tone)} className={`px-3 py-1.5 rounded-lg transition text-xs ${responseTone === tone ? 'bg-purple-500 text-white' : `${theme === 'dark' ? 'bg-slate-600 text-gray-300' : 'bg-white text-gray-700'}`}`}>{tone}</button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className={`${textColor} font-semibold mb-2 text-sm flex items-center gap-2`}><Languages className="w-4 h-4" />Language</h3>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`w-full px-3 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-slate-600 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                  {Object.entries(languages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </div>
              <div>
                <h3 className={`${textColor} font-semibold mb-2 text-sm`}>Customize Bot</h3>
                <input type="text" value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="Bot Name" className={`w-full px-3 py-2 rounded-lg text-sm mb-2 ${theme === 'dark' ? 'bg-slate-600 text-white' : 'bg-white text-gray-900 border border-gray-200'}`} />
                <div className="flex gap-2">{['🤖', '🦾', '🧠', '💡', '⚡', '🎯', '🚀', '🌟'].map(emoji => (<button key={emoji} onClick={() => setBotAvatar(emoji)} className={`p-2 text-2xl rounded-lg ${botAvatar === emoji ? 'bg-purple-500' : `${theme === 'dark' ? 'bg-slate-600' : 'bg-white'} hover:bg-purple-400`}`}>{emoji}</button>))}</div>
              </div>
            </div>
          )}

          {previewFile && (
            <div className={`mt-3 p-3 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'} rounded-lg flex items-center gap-3`}>
              {previewFile.type === 'image' && <img src={previewFile.url} alt="Preview" className="w-16 h-16 rounded object-cover" />}
              {previewFile.type === 'document' && <FileText className="w-12 h-12 text-blue-500" />}
              <div className="flex-1">
                <p className={`text-sm font-semibold ${textColor}`}>{previewFile.name}</p>
                {previewFile.size && <p className="text-xs text-gray-500">{(previewFile.size / 1024).toFixed(2)} KB</p>}
              </div>
              <button onClick={() => { setPreviewFile(null); setSelectedFile(null); }} className="p-1 hover:bg-red-500/20 rounded"><X className="w-5 h-5 text-red-400" /></button>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4">
          {filteredMessages.length === 0 && !searchQuery && (
            <div className="text-center mt-10 md:mt-20">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl text-2xl md:text-4xl">{botAvatar}</div>
              <h3 className={`text-xl md:text-3xl font-bold ${textColor} mb-2`}>How can I help?</h3>
              <p className="text-gray-400 text-sm md:text-lg mb-4">Upload files, ask questions, or chat!</p>
              <div className="flex gap-2 justify-center flex-wrap px-4">
                <div className={`px-3 py-2 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-white shadow'} rounded-lg text-xs`}>💬 Multi-language</div>
                <div className={`px-3 py-2 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-white shadow'} rounded-lg text-xs`}>🎨 Themes</div>
                <div className={`px-3 py-2 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-white shadow'} rounded-lg text-xs`}>📌 Pin</div>
                <div className={`px-3 py-2 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-white shadow'} rounded-lg text-xs`}>🔍 Search</div>
                <div className={`px-3 py-2 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-white shadow'} rounded-lg text-xs`}>🎤 Voice</div>
              </div>
            </div>
          )}

          {searchQuery && filteredMessages.length === 0 && (
            <div className="text-center mt-20"><Search className="w-16 h-16 text-gray-400 mx-auto mb-4" /><p className="text-gray-400">No messages found for "{searchQuery}"</p></div>
          )}

          {filteredMessages.map((message) => (
            <div key={message.id} className={`flex gap-2 md:gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${message.pinned ? 'bg-yellow-500/10 rounded-lg p-2' : ''}`}>
              {message.role !== 'user' && (
                <div className={`w-8 h-8 md:w-10 md:h-10 ${message.role === 'system' ? 'bg-gradient-to-br from-green-500 to-emerald-500' : 'bg-gradient-to-br from-purple-500 to-pink-500'} rounded-full flex items-center justify-center flex-shrink-0 shadow-lg text-base md:text-xl`}>{message.role === 'system' ? '⚙️' : botAvatar}</div>
              )}
              
              <div className={`max-w-[85%] md:max-w-2xl ${
                message.role === 'user' ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white' : 
                message.role === 'system' ? 'bg-gradient-to-r from-green-600/80 to-emerald-600/80 text-white' : 
                messageBg
              } rounded-2xl p-3 md:p-5 shadow-xl relative`}>
                {message.pinned && <Pin className="w-3 h-3 md:w-4 md:h-4 text-yellow-400 absolute top-2 right-2" />}
                {message.image && <img src={message.image} alt="Uploaded" className="max-w-xs rounded-lg mb-3" />}
                <p className={`${message.role === 'user' || message.role === 'system' ? 'text-white' : textColor} whitespace-pre-wrap leading-relaxed text-sm md:text-base break-words`}>{message.content}</p>
                
                {message.sources && message.sources.length > 0 && (
                  <div className={`mt-3 pt-3 border-t ${theme === 'dark' ? 'border-purple-500/30' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-xs ${theme === 'dark' ? 'text-purple-300' : 'text-purple-600'} font-semibold flex items-center gap-1`}><ExternalLink className="w-3 h-3" />Sources ({message.sources.length})</p>
                      <button onClick={() => toggleSources(message.id)} className={`text-xs ${theme === 'dark' ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'} transition`}>{showAllSources[message.id] ? 'Hide' : 'Show'}</button>
                    </div>
                    {(showAllSources[message.id] ? message.sources : message.sources.slice(0, 1)).map((source, idx) => (
                      <div key={idx} className={`text-xs ${theme === 'dark' ? 'text-gray-300 bg-slate-800/50' : 'text-gray-700 bg-gray-50'} p-2 rounded-lg mb-2 border ${theme === 'dark' ? 'border-purple-500/20' : 'border-gray-200'}`}>
                        <span className={`${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'} font-semibold`}>Source #{source.id}</span>
                        <p className="mt-1">{source.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {message.role === 'assistant' && (
                  <div className={`flex items-center gap-2 mt-3 pt-3 border-t ${theme === 'dark' ? 'border-slate-600' : 'border-gray-200'}`}>
                    <button onClick={() => handleFeedback(message.id, 'good')} className={`p-1.5 rounded transition ${message.feedback === 'good' ? 'bg-green-500/30 text-green-400' : `${theme === 'dark' ? 'hover:bg-slate-600 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}`}><ThumbsUp className="w-3 h-3 md:w-4 md:h-4" /></button>
                    <button onClick={() => handleFeedback(message.id, 'bad')} className={`p-1.5 rounded transition ${message.feedback === 'bad' ? 'bg-red-500/30 text-red-400' : `${theme === 'dark' ? 'hover:bg-slate-600 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}`}><ThumbsDown className="w-3 h-3 md:w-4 md:h-4" /></button>
                    <button onClick={() => togglePin(message.id)} className={`p-1.5 rounded transition ${message.pinned ? 'bg-yellow-500/30 text-yellow-400' : `${theme === 'dark' ? 'hover:bg-slate-600 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}`}><Pin className="w-3 h-3 md:w-4 md:h-4" /></button>
                    <button onClick={() => speakText(message.content)} disabled={isSpeaking} className={`p-1.5 rounded transition disabled:opacity-50 ml-auto ${theme === 'dark' ? 'hover:bg-slate-600 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}><Volume2 className="w-3 h-3 md:w-4 md:h-4" /></button>
                  </div>
                )}

                {(message.role === 'user' || message.role === 'system') && (
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => togglePin(message.id)} className={`p-1.5 rounded transition ${message.pinned ? 'bg-yellow-500/30 text-yellow-400' : 'hover:bg-purple-500/30 text-gray-400'}`}><Pin className="w-3 h-3 md:w-4 md:h-4" /></button>
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                  <User className="w-4 h-4 md:w-6 md:h-6 text-white" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2 md:gap-4">
              <div className={`w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg text-base md:text-xl`}>{botAvatar}</div>
              <div className={`${messageBg} rounded-2xl p-3 md:p-5 shadow-xl`}>
                <div className="flex gap-2 items-center">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className={`${bgColor} backdrop-blur-sm border-t ${theme === 'dark' ? 'border-purple-500/30' : 'border-gray-200'} p-2 md:p-4`}>
          <div className="flex gap-1 md:gap-2 mb-2">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".pdf,.txt,.doc,.docx,.csv,.xlsx" />
            <input type="file" ref={imageInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" />
            
            <button onClick={() => fileInputRef.current?.click()} className="p-2 md:p-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-xl transition shadow-lg" title="Upload File">
              <Paperclip className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button onClick={() => imageInputRef.current?.click()} className="p-2 md:p-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-xl transition shadow-lg" title="Upload Image">
              <Camera className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button onClick={startListening} disabled={isListening || isLoading} className={`p-2 md:p-3 ${isListening ? 'bg-red-500/30 animate-pulse' : 'bg-purple-500/20 hover:bg-purple-500/30'} text-purple-400 rounded-xl transition shadow-lg disabled:opacity-50`} title="Voice">
              <Mic className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Type in ${languages[language]}...`}
              className={`flex-1 ${inputBg} placeholder-gray-400 rounded-xl px-3 md:px-5 py-2 md:py-3 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-lg`}
            />
            <button onClick={sendMessage} disabled={isLoading || !inputMessage.trim()} className="px-3 md:px-6 py-2 md:py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition flex items-center gap-1 md:gap-2 font-semibold shadow-lg text-sm md:text-base">
              <Send className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          
          <div className={`flex items-center justify-between text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            <div className="flex items-center gap-2 md:gap-4">
              <span className="hidden sm:inline">🌍 {languages[language]}</span>
              <span className="hidden md:inline">🎨 {responseTone}</span>
              <span>💬 {messages.length}</span>
            </div>
            <div className="flex items-center gap-2">
              {isListening && <span className="text-red-400 animate-pulse">🎤</span>}
              {isSpeaking && <span className={`${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'} animate-pulse`}>🔊</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWidget;