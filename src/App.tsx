/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  History as HistoryIcon, 
  User, 
  Home, 
  Plus, 
  Flame, 
  Zap, 
  Droplets, 
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Settings,
  LogOut,
  Calendar,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

type AppState = 'idle' | 'loading' | 'result' | 'error';

interface AnalysisResult {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
}

interface HistoryItem extends AnalysisResult {
  id: string;
  timestamp: number;
  image?: string;
}

interface UserProfile {
  name: string;
  dailyGoal: number;
  weight: number;
  height: number;
}

const DEFAULT_PROFILE: UserProfile = {
  name: "Alex Johnson",
  dailyGoal: 2200,
  weight: 75,
  height: 180
};

export default function App() {
  const [state, setState] = useState<AppState>('idle');
  const [activeTab, setActiveTab] = useState('home');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Persisted State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  const [quote] = useState(() => {
    const quotes = [
      "Your health is an investment, not an expense.",
      "A journey of a thousand miles begins with a single step.",
      "The only bad workout is the one that didn't happen.",
      "Eat for the body you want, not the body you have.",
      "Consistency is the key to success.",
      "Small changes make a big difference."
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from Local Storage
  useEffect(() => {
    const savedHistory = localStorage.getItem('calai_history');
    const savedProfile = localStorage.getItem('calai_profile');
    
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedProfile) setProfile(JSON.parse(savedProfile));
  }, []);

  // Save to Local Storage
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('calai_history', JSON.stringify(history));
    }
  }, [history]);

  useEffect(() => {
    localStorage.setItem('calai_profile', JSON.stringify(profile));
  }, [profile]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setState('loading');
    setError(null);

    try {
      const base64Data = await fileToBase64(file);
      const analysis = await analyzeImage(base64Data, file.type);
      setResult(analysis);
      setState('result');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze image");
      setState('error');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const analyzeImage = async (base64Data: string, mimeType: string): Promise<AnalysisResult> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here' || apiKey === '') {
      throw new Error("API Key not configured. Please add your GEMINI_API_KEY to the .env file.");
    }
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: "Analyze this meal image. Identify the food and estimate its nutritional content (calories, protein in grams, carbs in grams, fat in grams). Provide a confidence score between 0 and 1.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            foodName: { type: Type.STRING },
            calories: { type: Type.NUMBER },
            protein: { type: Type.NUMBER },
            carbs: { type: Type.NUMBER },
            fat: { type: Type.NUMBER },
            confidence: { type: Type.NUMBER },
          },
          required: ["foodName", "calories", "protein", "carbs", "fat", "confidence"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as AnalysisResult;
  };

  const logToDiary = () => {
    if (!result) return;
    
    const newItem: HistoryItem = {
      ...result,
      id: Date.now().toString(),
      timestamp: Date.now(),
      image: imagePreview || undefined
    };
    
    setHistory(prev => [newItem, ...prev]);
    reset();
    setActiveTab('home');
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const reset = () => {
    setState('idle');
    setResult(null);
    setImagePreview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getTodayCalories = () => {
    const today = new Date().setHours(0, 0, 0, 0);
    return history
      .filter(item => new Date(item.timestamp).setHours(0, 0, 0, 0) === today)
      .reduce((sum, item) => sum + item.calories, 0);
  };

  const todayCalories = getTodayCalories();
  const progress = Math.min((todayCalories / profile.dailyGoal) * 100, 100);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-0 sm:p-4 overflow-hidden">
      {/* Mobile Container */}
      <div className="w-full max-w-[420px] h-screen sm:h-[844px] bg-[#0A0A0A] relative overflow-hidden sm:rounded-[48px] sm:border-[8px] border-[#1A1A1A] shadow-2xl flex flex-col">
        
        {/* Status Bar Spacer (iOS Style) */}
        <div className="h-12 w-full flex items-center justify-between px-8 pt-2">
          <span className="text-xs font-semibold opacity-80">9:41</span>
          <div className="flex gap-1.5 items-center">
            <div className="w-4 h-4 rounded-full border border-white/20" />
            <div className="w-4 h-4 rounded-full border border-white/20" />
            <div className="w-6 h-3 rounded-sm border border-white/20" />
          </div>
        </div>

        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />

        {/* Header */}
        <header className="px-6 pt-4 pb-2 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              CalAI
            </h1>
            <p className="text-white/40 text-sm font-medium">
              {activeTab === 'home' ? 'Track your meal instantly' : 'Your meal history'}
            </p>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-6 pt-4 pb-24 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {state === 'idle' && activeTab === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Daily Progress Card */}
                <div className="glass p-6 rounded-[32px] relative overflow-hidden">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg">Daily Goal</h3>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${progress >= 100 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {progress >= 100 ? 'Goal Reached' : 'On Track'}
                    </span>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="relative w-24 h-24">
                      <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle 
                          cx="50" cy="50" r="45" 
                          fill="none" 
                          stroke="rgba(255,255,255,0.05)" 
                          strokeWidth="8" 
                        />
                        <motion.circle 
                          cx="50" cy="50" r="45" 
                          fill="none" 
                          stroke={progress >= 100 ? "#ef4444" : "url(#gradient)"} 
                          strokeWidth="8" 
                          strokeDasharray="283"
                          initial={{ strokeDashoffset: 283 }}
                          animate={{ strokeDashoffset: 283 - (283 * (progress / 100)) }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          strokeLinecap="round"
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#34d399" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-bold">{Math.round(progress)}%</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/40">Consumed</span>
                        <span className="font-semibold">{Math.round(todayCalories)} kcal</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/40">Remaining</span>
                        <span className="font-semibold">{Math.max(0, profile.dailyGoal - todayCalories)} kcal</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upload Card */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUploadClick}
                  className="w-full aspect-square glass rounded-[40px] flex flex-col items-center justify-center gap-4 group border-dashed border-white/20 hover:border-white/40 transition-colors"
                >
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                    <Camera size={32} className="text-white/80" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-lg">Scan Your Meal</p>
                    <p className="text-white/40 text-sm">AI will analyze calories & macros</p>
                  </div>
                </motion.button>

                {/* Motivational Quote */}
                <div className="glass p-6 rounded-[32px] flex flex-col items-center text-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Zap size={20} className="text-emerald-400" />
                  </div>
                  <p className="italic text-white/80 font-medium">
                    "{quote}"
                  </p>
                </div>
              </motion.div>
            )}

            {state === 'idle' && activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {history.length === 0 ? (
                  <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                    <HistoryIcon size={64} />
                    <p className="text-lg font-medium">No meals logged yet</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="glass p-4 rounded-3xl flex items-center gap-4 group">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/5 flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.foodName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Zap size={20} className="text-white/20" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{item.foodName}</h4>
                        <p className="text-xs text-white/40">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(item.timestamp).toLocaleDateString()}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white/5 rounded text-white/60">{item.calories} kcal</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-500/10 rounded text-emerald-400/80">P: {item.protein}g</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteHistoryItem(item.id)}
                        className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400/60 hover:text-red-400"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {state === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="h-full flex flex-col items-center justify-center space-y-8"
              >
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-32 h-32 rounded-full border-4 border-white/5 border-t-emerald-500"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Camera size={32} className="text-emerald-500/50" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold">Analyzing Meal</h2>
                  <p className="text-white/40 animate-pulse">Our AI is identifying ingredients...</p>
                </div>
              </motion.div>
            )}

            {state === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center space-y-6 px-4 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle size={40} className="text-red-400" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Analysis Failed</h2>
                  <p className="text-white/40">{error || "Something went wrong while scanning your meal."}</p>
                </div>
                <button
                  onClick={reset}
                  className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-2xl font-semibold transition-colors"
                >
                  Try Again
                </button>
              </motion.div>
            )}

            {state === 'result' && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Result Image Preview */}
                <div className="w-full aspect-video rounded-[32px] overflow-hidden relative glass">
                  {imagePreview && (
                    <img 
                      src={imagePreview} 
                      alt="Analyzed Meal"
                      className="w-full h-full object-cover opacity-80"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="absolute top-4 right-4">
                    <div className="glass px-3 py-1.5 rounded-full flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      <span className="text-xs font-bold">AI Conf: {Math.round(result.confidence * 100)}%</span>
                    </div>
                  </div>
                </div>

                {/* Result Details */}
                <div className="glass p-8 rounded-[40px] space-y-8">
                  <div className="text-center">
                    <h2 className="text-white/40 font-medium mb-1">Estimated Calories</h2>
                    <div className="text-6xl font-black tracking-tighter">
                      {Math.round(result.calories)} <span className="text-xl font-bold text-white/20">kcal</span>
                    </div>
                    <p className="text-lg font-semibold mt-2">{result.foodName}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center space-y-1">
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          className="h-full bg-emerald-500"
                        />
                      </div>
                      <p className="text-xs text-white/40 uppercase font-bold tracking-wider">Protein</p>
                      <p className="font-bold">{Math.round(result.protein)}g</p>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          className="h-full bg-orange-400"
                        />
                      </div>
                      <p className="text-xs text-white/40 uppercase font-bold tracking-wider">Carbs</p>
                      <p className="font-bold">{Math.round(result.carbs)}g</p>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          className="h-full bg-blue-400"
                        />
                      </div>
                      <p className="text-xs text-white/40 uppercase font-bold tracking-wider">Fat</p>
                      <p className="font-bold">{Math.round(result.fat)}g</p>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={logToDiary}
                    className="w-full py-5 bg-white text-black rounded-3xl font-bold text-lg shadow-xl shadow-white/10"
                  >
                    Log to Diary
                  </motion.button>
                </div>

                <button 
                  onClick={reset}
                  className="w-full text-center text-white/40 text-sm font-medium"
                >
                  Not correct? Retake Photo
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Bottom Navigation */}
        <nav className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] h-18 glass-dark rounded-[32px] flex items-center justify-around px-4 z-50">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-white' : 'text-white/30'}`}
          >
            <Home size={24} />
            <div className={`w-1 h-1 rounded-full bg-white transition-opacity ${activeTab === 'home' ? 'opacity-100' : 'opacity-0'}`} />
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'history' ? 'text-white' : 'text-white/30'}`}
          >
            <HistoryIcon size={24} />
            <div className={`w-1 h-1 rounded-full bg-white transition-opacity ${activeTab === 'history' ? 'opacity-100' : 'opacity-0'}`} />
          </button>
        </nav>

        {/* Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[40%] bg-emerald-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[40%] bg-blue-500/10 blur-[120px] pointer-events-none" />
      </div>
    </div>
  );
}
