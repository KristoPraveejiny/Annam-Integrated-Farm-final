import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUploadCloud, FiTrash2, FiAlertCircle, FiLoader, FiCheckCircle, FiInfo,
  FiCloudRain, FiSun, FiWind, FiCalendar, FiClock, FiFileText, FiShield,
  FiZap, FiCompass, FiPercent, FiTrendingUp, FiCheck, FiMessageSquare, FiX
} from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { generateTextPDF } from '../utils/pdfGenerator';
import { createSession, sendChatMessage } from '../api/chat';

interface TopPrediction {
  disease: string;
  confidence: number;
}

interface AnalysisResult {
  disease: string;
  confidence: number;
  top_3?: TopPrediction[];
  image_url?: string;
  crop_name?: string; // dynamic fallback
  weatherSummary?: {
    temperature: number;
    humidity: number;
    description: string;
    windSpeed: number;
  };
  aiRecommendation?: {
    disease_explanation: string;
    possible_causes: string[];
    organic_treatment: string[];
    chemical_treatment: string[];
    immediate_action: string[];
    future_prevention: string[];
    weather_based_advice: string;
  };
  mockMetrics?: {
    severity: string;
    spreadSpeed: string;
    recoveryTime: string;
    riskLevel: string;
  };
}

interface WeatherSummaryData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  rainProbability: number;
  condition: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  suitableForSpraying: 'YES' | 'NO';
}

const SUPPORTED_CROPS = [
  { name: 'Tomato', emoji: '🍅', diseases: 8 },
  { name: 'Beans', emoji: '🫘', diseases: 5 },
  { name: 'Papaya', emoji: '🥭', diseases: 6 },
  { name: 'Mango', emoji: '🥭', diseases: 8 },
  { name: 'Brinjal', emoji: '🍆', diseases: 5 },
  { name: 'Coconut', emoji: '🥥', diseases: 4 },
  { name: 'Paddy', emoji: '🌾', diseases: 7 },
  { name: 'Corn', emoji: '🌽', diseases: 6 },
  { name: 'Green Chilli', emoji: '🌶', diseases: 5 },
  { name: 'Ladies Finger', emoji: '🥬', diseases: 4 },
  { name: 'Lemon', emoji: '🍋', diseases: 5 },
  { name: 'Turmeric', emoji: '🟡', diseases: 4 },
];

const LOADING_STEPS = [
  "Scanning Leaf...",
  "Loading AI Model...",
  "Analyzing Disease...",
  "Generating Recommendation...",
  "Almost Done..."
];

interface HistoryItem {
  id: string;
  crop_name: string;
  disease_name: string;
  confidence: number;
  uploaded_image: string;
  weather_summary?: {
    temperature: number;
    description: string;
  };
  ai_recommendation?: {
    disease_explanation: string;
    possible_causes: string[];
    organic_treatment: string[];
    chemical_treatment: string[];
    immediate_action?: string[];
    future_prevention?: string[];
    weather_based_advice: string;
  };
  created_at: string;
}

export default function DiseaseDetectionPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);
  
  // Reward worker state
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [isRewarding, setIsRewarding] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Preview file stats
  const [fileSize, setFileSize] = useState<string>('');
  const [resolution, setResolution] = useState<string>('Detecting...');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cycling the loading messages
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 1800);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Fetch prediction history & workers
  useEffect(() => {
    fetchHistory();
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/tasks/workers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkers(data);
      }
    } catch (err) {
      console.error('Error fetching workers:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/ai/disease-history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Error fetching prediction history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const processFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Invalid file type. Please upload an image file (JPG, PNG, JPEG).');
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File is too large. Maximum size allowed is 5 MB.');
      return;
    }
    setError(null);
    setResult(null);
    setFile(selectedFile);

    // Format file size
    const sizeInMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
    setFileSize(`${sizeInMB} MB`);

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    // Get Image Resolution
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth < 200 || img.naturalHeight < 200) {
        setError(`Image resolution is too low (${img.naturalWidth}x${img.naturalHeight}). Please upload a clearer image (at least 200x200 pixels).`);
        setFile(null);
        URL.revokeObjectURL(objectUrl);
        setPreviewUrl(null);
        setResolution('N/A');
        setFileSize('N/A');
        return;
      }
      setResolution(`${img.naturalWidth} x ${img.naturalHeight}`);
    };
    img.src = objectUrl;
  };

  const uploadAndAnalyze = async () => {
    if (!file || !selectedCrop) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', file);
    formData.append('crop', selectedCrop);
    formData.append('language', i18n.language || 'en');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/ai/disease-detection', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      setResult(data as AnalysisResult);
      
      // Auto-fetch AI Recommendation for the PDF
      if (data.disease && data.disease.toLowerCase() !== 'healthy') {
        fetchAIRecommendation(selectedCrop, data.disease, data.confidence);
      }
      
      // Refresh prediction history
      fetchHistory();
    } catch (err: any) {
      console.error('API Error:', err);
      setError(err.message || 'Failed to connect to the AI model server.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAIRecommendation = async (crop: string, disease: string, confidence: number) => {
    setLoadingRecommendation(true);
    setAiRecommendation('');
    try {
      const session = await createSession(`Disease Alert: ${crop}`);
      const query = `The CNN model detected ${disease} in my ${crop} crop with ${confidence.toFixed(2)}% confidence. Please provide a detailed summary: 1. What is this disease? 2. Why does it happen? 3. What fertilizers, pesticides, or actions should I take to treat it?`;
      
      await sendChatMessage(query, session.id, undefined, crop, disease, confidence, {
        onChunk: (text) => setAiRecommendation(prev => (prev || '') + text),
        onDone: () => setLoadingRecommendation(false),
        onError: () => setLoadingRecommendation(false)
      });
    } catch (err) {
      console.error('Failed to fetch recommendation', err);
      setLoadingRecommendation(false);
    }
  };

  const handleDownloadReport = () => {
    if (!reportRef.current) return;
    const opt = {
      margin:       0.5,
      filename:     `Disease_Report_${result?.crop_name || 'Crop'}_${new Date().toISOString().split('T')[0]}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' as const }
    };
    html2pdf().set(opt).from(reportRef.current).save();
  };

  const handleRewardWorker = async () => {
    if (!selectedWorkerId || !bonusAmount || isNaN(Number(bonusAmount))) {
      alert("Please select a worker and enter a valid bonus amount.");
      return;
    }
    
    setIsRewarding(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/disease-reports/reward-worker', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          worker_id: selectedWorkerId,
          amount: Number(bonusAmount),
          disease_name: result?.disease
        })
      });

      if (response.ok) {
        alert("Reward issued successfully! Downloading report...");
        setIsRewardModalOpen(false);
        handleDownloadReport();
      } else {
        const err = await response.json();
        alert(err.error || "Failed to issue reward");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while rewarding.");
    } finally {
      setIsRewarding(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setResolution('Detecting...');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setSelectedCrop(item.crop_name);
    setPreviewUrl(`http://localhost:5000${item.uploaded_image}`);
    setFile(null); // Clear active file so it doesn't try to upload again
    setFileSize('N/A');
    setResolution('N/A');

    // Format results to match active state
    setResult({
      disease: item.disease_name,
      confidence: item.confidence,
      crop_name: item.crop_name,
      weatherSummary: item.weather_summary ? {
        temperature: item.weather_summary.temperature,
        humidity: 65, // default fallback
        description: item.weather_summary.description,
        windSpeed: 12 // default fallback
      } : undefined,
      aiRecommendation: item.ai_recommendation ? {
        disease_explanation: item.ai_recommendation.disease_explanation,
        possible_causes: item.ai_recommendation.possible_causes || [],
        organic_treatment: item.ai_recommendation.organic_treatment || [],
        chemical_treatment: item.ai_recommendation.chemical_treatment || [],
        immediate_action: item.ai_recommendation.immediate_action || [],
        future_prevention: item.ai_recommendation.future_prevention || [],
        weather_based_advice: item.ai_recommendation.weather_based_advice || ''
      } : undefined
    });

    // Scroll to results
    setTimeout(() => {
      const el = document.getElementById('result-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  // Derive weather card details
  const tempVal = result?.weatherSummary?.temperature ?? 28;
  const humidityVal = result?.weatherSummary?.humidity ?? 70;
  const windVal = result?.weatherSummary?.windSpeed ?? 14;
  const rainProbVal = humidityVal > 80 ? 80 : humidityVal > 60 ? 40 : 10;
  const weatherCond = result?.weatherSummary?.description ?? 'Partly Cloudy';
  const riskLevelVal: 'Low' | 'Medium' | 'High' = humidityVal > 80 ? 'High' : humidityVal > 60 ? 'Medium' : 'Low';
  const suitableSp = (riskLevelVal === 'Low' && windVal < 20) ? 'YES' : 'NO';

  // Mock metrics for UI
  const getMockMetrics = (disease: string, confidence: number) => {
    const dLower = disease.toLowerCase();
    if (dLower.includes('canker') || dLower.includes('blight') || dLower.includes('wilt') || dLower.includes('virus')) {
      return { severity: 'Critical', spreadSpeed: 'Rapid (1-2 days)', recoveryTime: '3-4 weeks', riskLevel: 'High' };
    } else if (dLower.includes('spot') || dLower.includes('rot') || dLower.includes('mildew') || dLower.includes('rust')) {
      return { severity: 'Moderate', spreadSpeed: 'Moderate (3-5 days)', recoveryTime: '1-2 weeks', riskLevel: 'Medium' };
    }
    return { severity: 'Low', spreadSpeed: 'Slow', recoveryTime: '1 week', riskLevel: 'Low' };
  };

  const metrics = result ? (result.mockMetrics || getMockMetrics(result.disease, result.confidence)) : null;

  const highlightCriticalValues = (text: string) => {
    const keywords = ['ml', 'mg', 'liter', 'liters', 'days', 'hours', 'dosage', 'spray', 'part', 'parts', 'every'];
    const regex = new RegExp(`\\b(\\d+\\.?\\d*\\s*(?:${keywords.join('|')})\\b|${keywords.join('|')})`, 'gi');
    
    const parts = text.split(regex);
    return parts.map((part, i) => {
      if (regex.test(part)) {
        return <span key={i} className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-md font-bold mx-0.5">{part}</span>;
      }
      return part;
    });
  };

  // Determine Confidence Meter color
  const getConfidenceColor = (conf: number) => {
    if (conf >= 90) return 'bg-[#00C853]';
    if (conf >= 70) return 'bg-[#FFC107]';
    if (conf >= 60) return 'bg-orange-400';
    return 'bg-[#FF5252]';
  };

  const getConfidenceTextColor = (conf: number) => {
    if (conf >= 90) return 'text-[#00C853]';
    if (conf >= 70) return 'text-[#FFC107]';
    if (conf >= 60) return 'text-orange-400';
    return 'text-[#FF5252]';
  };

  const getStatusBadge = (conf: number) => {
    if (conf >= 90) return { label: 'Highly Confident', icon: '🟢', textClass: 'text-[#00C853]' };
    if (conf >= 70) return { label: 'Moderate Confidence', icon: '🟡', textClass: 'text-[#FFC107]' };
    if (conf >= 60) return { label: 'Acceptable Confidence', icon: '🟠', textClass: 'text-orange-400' };
    return { label: 'Low Confidence', icon: '🔴', textClass: 'text-[#FF5252]' };
  };

  return (
    <div className="min-h-screen bg-[#081C15] text-white p-4 md:p-8 space-y-8 font-sans selection:bg-[#00C853] selection:text-white">
      {/* 1. Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full flex flex-col md:flex-row md:items-center justify-between border border-[#112D2B] bg-[#112D2B]/50 backdrop-blur-md rounded-2xl p-6 md:p-8 shadow-xl"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🌿</span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-emerald-100 to-[#00C853] bg-clip-text text-transparent">
              AI Crop Disease Detection
            </h1>
          </div>
          <p className="text-sm md:text-base text-[#B0BEC5] max-w-2xl">
            Analyze crop diseases using AI-powered Deep Learning models.
          </p>
        </div>
        <Link to="/dashboard/farm-manager/disease-history" className="mt-4 md:mt-0">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="w-full md:w-auto px-6 py-3 rounded-xl border border-[#00C853]/40 bg-[#00C853]/10 hover:bg-[#00C853]/20 hover:border-[#00C853] text-[#00C853] font-bold text-sm tracking-wide transition-all shadow-[0_0_15px_rgba(0,200,83,0.1)]"
          >
            Open Disease History
          </motion.button>
        </Link>
      </motion.div>

      {/* 2. Crop Selection */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#00C853] animate-ping" />
            1. Select Crop Type
          </h2>
          <p className="text-xs text-[#B0BEC5] mt-1">
            Choose the target crop to optimize detection accuracy. Only one crop can be selected at a time.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {SUPPORTED_CROPS.map((crop) => {
            const isSelected = selectedCrop === crop.name;
            return (
              <motion.button
                key={crop.name}
                onClick={() => setSelectedCrop(crop.name)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className={`relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all text-center h-32 ${
                  isSelected
                    ? 'bg-[#112D2B] border-[#00C853] shadow-[0_0_15px_rgba(0,200,83,0.25)]'
                    : 'bg-[#112D2B]/40 border-emerald-950 hover:bg-[#112D2B]/80 hover:border-[#00C853]/50'
                }`}
              >
                <div className="text-3xl mb-2 filter drop-shadow-md">{crop.emoji}</div>
                <div className="font-bold text-sm text-white">{crop.name}</div>
                <div className="text-[10px] text-[#B0BEC5] mt-1">
                  {crop.diseases} Diseases Supported
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-[#00C853] text-[#081C15] rounded-full p-0.5">
                    <FiCheck size={12} className="stroke-[3]" />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 3 & 4. Image Upload & Preview Section */}
      <AnimatePresence mode="wait">
        {selectedCrop && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Upload Area */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <span>📷</span> 2. Upload Leaf Image
              </h2>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative h-64 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition-all p-6 text-center ${
                  isDragging
                    ? 'border-[#00C853] bg-[#00C853]/10 scale-[1.01]'
                    : 'border-emerald-800/80 bg-[#112D2B]/35 hover:bg-[#112D2B]/60 hover:border-[#00C853]/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/jpg"
                  className="hidden"
                />
                <motion.div
                  animate={isDragging ? { y: -8 } : { y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  className="p-4 rounded-full bg-[#112D2B]/80 text-[#00C853] mb-4 shadow-md"
                >
                  <FiUploadCloud size={36} />
                </motion.div>
                <p className="font-bold text-base text-white">Drag Image Here</p>
                <p className="text-xs text-[#B0BEC5] my-1">OR</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2 bg-[#00C853] hover:bg-[#00E676] text-[#081C15] font-extrabold text-xs rounded-lg transition-colors shadow-lg"
                >
                  Browse Image
                </button>
                <p className="text-[10px] text-[#B0BEC5] mt-4">
                  Supported formats: JPG, JPEG, PNG | Maximum 5 MB
                </p>
              </div>
            </div>

            {/* Preview Area */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <span>🖼️</span> Image Preview
              </h2>
              <div className="h-64 rounded-2xl border border-emerald-950 bg-[#112D2B]/40 p-4 flex flex-col md:flex-row gap-4 justify-between items-center relative overflow-hidden">
                {previewUrl ? (
                  <>
                    <div className="h-full w-full md:w-1/2 rounded-xl overflow-hidden bg-black/40 border border-emerald-950 flex items-center justify-center">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-between h-full py-2 w-full">
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-500 font-semibold text-xs tracking-wider uppercase">Crop:</span>
                          <span className="text-sm font-bold">{selectedCrop}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[#B0BEC5] text-[10px] uppercase">File Name</span>
                          <span className="text-xs font-medium truncate max-w-[200px]">
                            {file?.name || 'Loaded from History'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[#B0BEC5] text-[10px] uppercase">File Size</span>
                          <span className="text-xs font-semibold">{fileSize}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[#B0BEC5] text-[10px] uppercase">Resolution</span>
                          <span className="text-xs font-semibold text-emerald-300">{resolution}</span>
                        </div>
                      </div>

                      <button
                        onClick={handleClear}
                        className="mt-3 py-2 px-3 border border-red-500/30 hover:border-red-500 bg-red-500/10 hover:bg-red-500/20 text-[#FF5252] font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 w-full"
                      >
                        <FiTrash2 size={13} />
                        Remove Image
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#B0BEC5]">
                    <span className="text-4xl mb-2">📸</span>
                    <p className="text-sm">No leaf image uploaded yet.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Analyze Button */}
      {selectedCrop && previewUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-4"
        >
          {loading ? (
            <div className="w-full max-w-md bg-[#112D2B] border border-emerald-900 rounded-2xl p-6 flex flex-col items-center text-center shadow-lg space-y-4">
              <FiLoader className="text-3xl text-[#00C853] animate-spin" />
              <div className="h-6 flex items-center justify-center">
                <motion.p
                  key={loadingStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="font-bold text-emerald-400 text-base"
                >
                  {LOADING_STEPS[loadingStep]}
                </motion.p>
              </div>
              <div className="w-full bg-[#081C15] h-2 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-500 to-[#00C853]"
                  initial={{ width: '0%' }}
                  animate={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
                  transition={{ duration: 1.5 }}
                />
              </div>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.03, boxShadow: '0 0 25px rgba(0, 200, 83, 0.4)' }}
              whileTap={{ scale: 0.97 }}
              onClick={uploadAndAnalyze}
              className="px-12 py-4 bg-gradient-to-r from-emerald-600 via-[#00C853] to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-[#081C15] font-extrabold text-lg rounded-2xl transition-all shadow-xl tracking-wider uppercase"
            >
              Analyze with AI
            </motion.button>
          )}
        </motion.div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-500 bg-red-500/10 text-[#FF5252] flex items-center gap-3">
          <FiAlertCircle size={22} className="shrink-0" />
          <p className="font-semibold text-sm">{error}</p>
        </div>
      )}

      {/* 6. AI Result Dashboard & 7. Confidence Meter */}
      <AnimatePresence>
        {result && (
          <motion.div
            id="result-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
            ref={reportRef}
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-emerald-950/80 pb-3 mt-2">
              <h2 className="text-xl font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                <span>📊</span> AI Diagnosis Dashboard
              </h2>
              
              <button 
                onClick={() => {
                  const cropName = result.crop_name || selectedCrop || 'Unknown';
                  const title = `AI Advisory Report: Disease Detection (${cropName})`;
                  let content = '';
                  
                  if (result.aiRecommendation) {
                    content += `Disease Summary:\n${result.aiRecommendation.disease_explanation}\n\n`;
                    
                    if (result.aiRecommendation.possible_causes && result.aiRecommendation.possible_causes.length > 0) {
                      content += `Possible Causes:\n`;
                      result.aiRecommendation.possible_causes.forEach((c: string) => content += `- ${c}\n`);
                      content += `\n`;
                    }
                    
                    if (result.aiRecommendation.organic_treatment && result.aiRecommendation.organic_treatment.length > 0) {
                      content += `Organic Treatment:\n`;
                      result.aiRecommendation.organic_treatment.forEach((c: string) => content += `- ${c}\n`);
                      content += `\n`;
                    }
                    
                    if (result.aiRecommendation.chemical_treatment && result.aiRecommendation.chemical_treatment.length > 0) {
                      content += `Chemical Treatment:\n`;
                      result.aiRecommendation.chemical_treatment.forEach((c: string) => content += `- ${c}\n`);
                      content += `\n`;
                    }
                    
                    if (result.aiRecommendation.immediate_action && result.aiRecommendation.immediate_action.length > 0) {
                      content += `Immediate Action:\n`;
                      result.aiRecommendation.immediate_action.forEach((c: string) => content += `- ${c}\n`);
                      content += `\n`;
                    }
                    
                    if (result.aiRecommendation.future_prevention && result.aiRecommendation.future_prevention.length > 0) {
                      content += `Future Prevention:\n`;
                      result.aiRecommendation.future_prevention.forEach((c: string) => content += `- ${c}\n`);
                      content += `\n`;
                    }
                    
                    if (result.aiRecommendation.weather_based_advice) {
                      content += `Weather-Based Recommendation:\n${result.aiRecommendation.weather_based_advice}\n\n`;
                    }
                  } else if (aiRecommendation) {
                    let cleanRecommendation = aiRecommendation.replace(/SUGGESTED_QUESTIONS:\s*\[.*?\]/gs, '').trim();
                    content = cleanRecommendation;
                  }
                  
                  generateTextPDF(title, content || 'No advice generated yet.', `AI_Advisory_Disease_${cropName}`);
                }}
                className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-slate-700 hover:text-emerald-300 border border-emerald-500/30"
                title="Download report as PDF"
              >
                <FiFileText />
                Generate PDF
              </button>
            </div>

            
            {result.confidence < 60 ? (
              <div className="space-y-6">
                <div className="bg-[#112D2B] border border-red-500/40 p-6 md:p-8 rounded-2xl shadow-md space-y-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="p-4 bg-red-500/20 text-[#FF5252] rounded-full">
                      <FiAlertCircle size={48} />
                    </div>
                    <h3 className="text-2xl font-bold text-white">⚠ Low Confidence Prediction</h3>
                    <p className="text-[#B0BEC5] max-w-2xl text-lg">
                      The AI model could not confidently identify the disease from this image ({result.confidence.toFixed(2)}%).
                    </p>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6 bg-[#081C15] p-6 rounded-xl border border-emerald-950">
                    <div>
                      <h4 className="text-[#FFC107] font-bold mb-3 flex items-center gap-2"><FiInfo /> Possible Reasons:</h4>
                      <ul className="list-disc pl-5 space-y-2 text-sm text-[#B0BEC5]">
                        <li>Poor image quality or blurry image</li>
                        <li>Multiple leaves in one image</li>
                        <li>Poor lighting or heavy shadows</li>
                        <li>Disease not clearly visible</li>
                        <li>Disease not included in the trained dataset</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-[#00C853] font-bold mb-3 flex items-center gap-2"><FiCheckCircle /> Suggestions:</h4>
                      <ul className="list-disc pl-5 space-y-2 text-sm text-[#B0BEC5]">
                        <li>Capture <span className="text-white font-bold">one infected leaf</span> only</li>
                        <li>Use natural daylight</li>
                        <li>Keep the camera close and in focus</li>
                        <li>Upload another image</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-col items-center pt-4 space-y-3">
                    <p className="text-[#B0BEC5] font-medium text-sm">Not satisfied with this prediction?</p>
                    <button
                      onClick={() => navigate('/dashboard/farm-manager/ai-chat', { state: { crop: result.crop_name || selectedCrop, predictedDisease: result.disease, confidence: result.confidence, top_3: result.top_3, imageUrl: result.image_url } })}
                      className="px-8 py-4 bg-gradient-to-r from-emerald-600 via-[#00C853] to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-[#081C15] font-extrabold text-lg rounded-2xl transition-all shadow-xl tracking-wider uppercase flex items-center gap-3"
                    >
                      <FiMessageSquare size={24} />
                      Consult AI Farm Advisor
                    </button>
                  </div>
                </div>
                
            
            {result.top_3 && result.top_3.length > 0 && (
              <div className="bg-[#112D2B] border border-emerald-900/40 p-6 rounded-xl shadow-md space-y-4">
                <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  <span>🎯</span> Top AI Predictions
                </h3>
                <div className="space-y-4">
                  {result.top_3.map((pred, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[#B0BEC5]">{idx + 1}. {pred.disease}</span>
                        <span className={getConfidenceTextColor(pred.confidence)}>{pred.confidence.toFixed(2)}%</span>
                      </div>
                      <div className="w-full bg-[#081C15] h-2 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(pred.confidence, 100)}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.2 }}
                          className={`h-full rounded-full ${getConfidenceColor(pred.confidence)}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

              </div>
            ) : (
              <>

            {/* Results Grid */}
            <div className="flex justify-end w-full mb-4">
               <button
                 onClick={() => navigate('/dashboard/farm-manager/ai-chat', { state: { crop: result.crop_name || selectedCrop, predictedDisease: result.disease, confidence: result.confidence, top_3: result.top_3, imageUrl: result.image_url } })}
                 className="px-6 py-2.5 bg-[#00C853] hover:bg-[#00E676] text-[#081C15] font-extrabold text-sm rounded-xl transition-colors shadow-lg flex items-center gap-2"
               >
                 <FiMessageSquare size={16} />
                 Ask AI Assistant
               </button>
            </div>

            {/* AI Auto Recommendation */}
            {(aiRecommendation || loadingRecommendation) && (
              <div className="bg-[#112D2B] border border-emerald-900/50 p-6 rounded-xl shadow-md space-y-4 mb-4">
                <h3 className="text-sm font-bold text-emerald-400 tracking-wide flex items-center gap-2">
                  <FiMessageSquare /> AI Treatment Recommendation
                </h3>
                <div className="prose prose-invert prose-emerald max-w-none text-sm text-slate-300">
                  {aiRecommendation}
                  {loadingRecommendation && <span className="inline-block w-2 h-4 ml-1 bg-emerald-500 animate-pulse" />}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Crop */}
              <div className="bg-[#112D2B] border border-emerald-900/50 p-4 rounded-xl shadow-md flex items-center gap-4">
                <div className="p-3 bg-emerald-900/30 text-emerald-400 rounded-lg">
                  <FiCompass size={22} />
                </div>
                <div>
                  <p className="text-[10px] text-[#B0BEC5] uppercase font-bold tracking-wider">Crop</p>
                  <p className="text-base font-bold text-white mt-0.5">{result.crop_name || selectedCrop}</p>
                </div>
              </div>

              {/* Card 2: Disease (Glowing Alert) */}
              <motion.div 
                animate={{ 
                  boxShadow: ["0px 0px 10px rgba(255, 82, 82, 0.3)", "0px 0px 30px rgba(255, 82, 82, 0.7)", "0px 0px 10px rgba(255, 82, 82, 0.3)"],
                  scale: [1, 1.03, 1]
                }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="bg-[#112D2B] border border-[#FF5252]/60 p-4 rounded-xl shadow-md flex items-center gap-4 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-red-500/5" />
                <div className="p-3 bg-red-500/20 text-[#FF5252] rounded-lg relative z-10">
                  <FiAlertCircle size={22} />
                </div>
                <div className="relative z-10">
                  <p className="text-[10px] text-[#FF5252] uppercase font-bold tracking-wider">Disease Alert</p>
                  <p className="text-base font-black text-[#FF5252] mt-0.5 truncate max-w-[140px]" title={result.disease}>
                    {result.disease}
                  </p>
                </div>
              </motion.div>

              {/* Card 3: Confidence */}
              <div className="bg-[#112D2B] border border-emerald-900/50 p-4 rounded-xl shadow-md flex items-center gap-4">
                <div className="p-3 bg-amber-950/30 text-[#FFC107] rounded-lg">
                  <FiPercent size={22} />
                </div>
                <div>
                  <p className="text-[10px] text-[#B0BEC5] uppercase font-bold tracking-wider">Confidence</p>
                  <p className="text-base font-bold text-white mt-0.5">
                    {(result.confidence).toFixed(2)}%
                    <span className="ml-2 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-md text-[10px] uppercase">{getStatusBadge(result.confidence).label.split(' ')[0]}</span>
                  </p>
                </div>
              </div>

              {/* Card 4: Detection Status */}
              <div className="bg-[#112D2B] border border-emerald-900/50 p-4 rounded-xl shadow-md flex items-center gap-4">
                <div className={`p-3 rounded-lg ${getStatusBadge(result.confidence).label === 'Highly Confident' ? 'bg-emerald-950/30 text-[#00C853]' : getStatusBadge(result.confidence).label === 'Moderate Confidence' ? 'bg-amber-950/30 text-[#FFC107]' : 'bg-orange-950/30 text-orange-400'}`}>
                  <span className="text-xl">{getStatusBadge(result.confidence).icon}</span>
                </div>
                <div>
                  <p className="text-[10px] text-[#B0BEC5] uppercase font-bold tracking-wider">Status</p>
                  <p className={`text-xs md:text-sm font-bold mt-0.5 ${getStatusBadge(result.confidence).textClass}`}>{getStatusBadge(result.confidence).label}</p>
                </div>
              </div>
            </div>

            {/* Advanced Metrics Cards */}
            {metrics && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <div className="bg-gradient-to-br from-[#112D2B] to-[#0a1f18] border border-red-500/30 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] text-[#B0BEC5] uppercase font-bold tracking-wider mb-1">Severity</span>
                  <span className={`text-sm font-black uppercase ${metrics.severity === 'Critical' ? 'text-red-500' : metrics.severity === 'Moderate' ? 'text-orange-400' : 'text-emerald-400'}`}>{metrics.severity}</span>
                </div>
                <div className="bg-gradient-to-br from-[#112D2B] to-[#0a1f18] border border-orange-500/30 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] text-[#B0BEC5] uppercase font-bold tracking-wider mb-1">Spread Speed</span>
                  <span className="text-sm font-bold text-orange-400">{metrics.spreadSpeed}</span>
                </div>
                <div className="bg-gradient-to-br from-[#112D2B] to-[#0a1f18] border border-emerald-500/30 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] text-[#B0BEC5] uppercase font-bold tracking-wider mb-1">Est. Recovery</span>
                  <span className="text-sm font-bold text-emerald-400">{metrics.recoveryTime}</span>
                </div>
                <div className="bg-gradient-to-br from-[#112D2B] to-[#0a1f18] border border-amber-500/30 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] text-[#B0BEC5] uppercase font-bold tracking-wider mb-1">Risk Level</span>
                  <span className="text-sm font-black text-amber-400 uppercase">{metrics.riskLevel}</span>
                </div>
              </div>
            )}

            {/* Confidence Meter Progress Bar */}
            <div className="bg-[#112D2B] border border-emerald-900/40 p-6 rounded-xl shadow-md space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-white tracking-wide">Confidence Rating</h3>
                <span className={`text-base font-extrabold ${getConfidenceTextColor(result.confidence)}`}>
                  {result.confidence.toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-[#081C15] h-4 rounded-full overflow-hidden border border-emerald-950 p-0.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(result.confidence, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${getConfidenceColor(result.confidence)}`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#B0BEC5] font-bold">
                <span className="text-[#FF5252]">High Risk (&lt;60%)</span>
                <span className="text-orange-400">Acceptable (60%-69%)</span>
                <span className="text-[#FFC107]">Warning (70%-89%)</span>
                <span className="text-[#00C853]">High Confidence (&gt;=90%)</span>
              </div>
            </div>

            {/* Top AI Predictions */}
            {result.top_3 && result.top_3.length > 0 && (
              <div className="bg-[#112D2B] border border-emerald-900/40 p-6 rounded-xl shadow-md space-y-4">
                <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  <span>🎯</span> Top AI Predictions
                </h3>
                <div className="space-y-4">
                  {result.top_3.map((pred, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[#B0BEC5]">{idx + 1}. {pred.disease}</span>
                        <span className={getConfidenceTextColor(pred.confidence)}>{pred.confidence.toFixed(2)}%</span>
                      </div>
                      <div className="w-full bg-[#081C15] h-2 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(pred.confidence, 100)}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.2 }}
                          className={`h-full rounded-full ${getConfidenceColor(pred.confidence)}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            
              </>
            )}
            
            {result.confidence >= 60 && (
<>
{/* 8. AI Recommendation Section */}
            {result.aiRecommendation && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <span>💡</span> AI Treatment & Prevention Advisory
                  </h2>
                  <div className="h-0.5 bg-emerald-950/80 w-full mt-2" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Card 1: Disease Summary */}
                  <div className="bg-[#112D2B] border border-emerald-500/30 p-5 rounded-xl shadow-md space-y-2 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/50" />
                    <div className="flex items-center gap-2.5 text-emerald-400 font-bold border-b border-emerald-900/40 pb-2 mb-2">
                      <FiFileText size={18} />
                      <span className="text-sm uppercase tracking-wider">Disease Summary</span>
                    </div>
                    <p className="text-xs text-[#B0BEC5] leading-relaxed">
                      {result.aiRecommendation.disease_explanation}
                    </p>
                  </div>

                  {/* Card 2: Possible Causes */}
                  <div className="bg-gradient-to-b from-[#FFC107]/10 to-[#112D2B] border border-[#FFC107]/30 p-5 rounded-xl shadow-md space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-[#FFC107]/50" />
                    <div className="flex items-center gap-2.5 text-[#FFC107] font-bold border-b border-[#FFC107]/20 pb-2">
                      <FiAlertCircle size={18} />
                      <span className="text-sm uppercase tracking-wider">Possible Causes</span>
                    </div>
                    <ul className="space-y-2">
                      {result.aiRecommendation.possible_causes.map((cause, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-[#B0BEC5] leading-relaxed">
                          <span className="text-[#FFC107] mt-0.5"><FiInfo size={12} /></span>
                          <span>{highlightCriticalValues(cause)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Card 3: Organic Treatment */}
                  <div className="bg-gradient-to-b from-[#00C853]/10 to-[#112D2B] border border-[#00C853]/30 p-5 rounded-xl shadow-md space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-[#00C853]/50" />
                    <div className="flex items-center gap-2.5 text-[#00C853] font-bold border-b border-[#00C853]/20 pb-2">
                      <span className="text-base">🌱</span>
                      <span className="text-sm uppercase tracking-wider">Organic Treatment</span>
                    </div>
                    <ul className="space-y-2">
                      {result.aiRecommendation.organic_treatment.map((treatment, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-[#B0BEC5] leading-relaxed">
                          <span className="text-[#00C853] mt-0.5"><FiCheckCircle size={12} /></span>
                          <span>{highlightCriticalValues(treatment)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Card 4: Chemical Treatment */}
                  <div className="bg-gradient-to-b from-[#FF5252]/10 to-[#112D2B] border border-[#FF5252]/30 p-5 rounded-xl shadow-md space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-[#FF5252]/50" />
                    <div className="flex items-center gap-2.5 text-[#FF5252] font-bold border-b border-[#FF5252]/20 pb-2">
                      <span className="text-base">🧪</span>
                      <span className="text-sm uppercase tracking-wider">Chemical Treatment</span>
                    </div>
                    <ul className="space-y-2">
                      {result.aiRecommendation.chemical_treatment.map((treatment, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-[#B0BEC5] leading-relaxed">
                          <span className="text-[#FF5252] mt-0.5"><FiCheckCircle size={12} /></span>
                          <span>{highlightCriticalValues(treatment)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Card 5: Immediate Action */}
                  <div className="bg-gradient-to-b from-orange-500/10 to-[#112D2B] border border-orange-500/30 p-5 rounded-xl shadow-md space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-orange-500/50" />
                    <div className="flex items-center gap-2.5 text-orange-400 font-bold border-b border-orange-500/20 pb-2">
                      <FiZap size={18} />
                      <span className="text-sm uppercase tracking-wider">Immediate Action</span>
                    </div>
                    <ul className="space-y-2">
                      {result.aiRecommendation.immediate_action.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-[#B0BEC5] leading-relaxed">
                          <span className="text-[#FFC107] mt-0.5"><FiZap size={12} /></span>
                          <span>{highlightCriticalValues(action)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Card 6: Future Prevention */}
                  <div className="bg-gradient-to-b from-blue-500/10 to-[#112D2B] border border-blue-500/30 p-5 rounded-xl shadow-md space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/50" />
                    <div className="flex items-center gap-2.5 text-blue-400 font-bold border-b border-blue-500/20 pb-2">
                      <FiShield size={18} />
                      <span className="text-sm uppercase tracking-wider">Future Prevention</span>
                    </div>
                    <ul className="space-y-2">
                      {result.aiRecommendation.future_prevention.map((prev, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-[#B0BEC5] leading-relaxed">
                          <span className="text-blue-400 mt-0.5"><FiShield size={12} /></span>
                          <span>{highlightCriticalValues(prev)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card 7: Weather-Based Recommendation */}
                <div className="bg-[#112D2B] border border-emerald-900/40 p-5 rounded-xl shadow-md">
                  <div className="flex items-center gap-2.5 text-[#00C853] font-bold border-b border-emerald-900/40 pb-2 mb-3">
                    <FiCloudRain size={18} />
                    <span className="text-sm uppercase tracking-wider">Weather-Based Recommendation</span>
                  </div>
                  <p className="text-xs text-[#B0BEC5] leading-relaxed">
                    {result.aiRecommendation.weather_based_advice}
                  </p>
                </div>
              </div>
            )}

            {/* 9. Weather Summary */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                  <span>🌤️</span> Local Weather Metrics & Spray Suitability
                </h2>
                <div className="h-0.5 bg-emerald-950/80 w-full mt-2" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Temp */}
                <div className="bg-[#112D2B] border border-emerald-900/40 p-4 rounded-xl text-center space-y-1">
                  <span className="text-2xl block">🌡️</span>
                  <span className="text-[10px] text-[#B0BEC5] font-bold uppercase tracking-wider block">Temperature</span>
                  <span className="text-base font-extrabold">{tempVal}°C</span>
                </div>

                {/* Humidity */}
                <div className="bg-[#112D2B] border border-emerald-900/40 p-4 rounded-xl text-center space-y-1">
                  <span className="text-2xl block">💧</span>
                  <span className="text-[10px] text-[#B0BEC5] font-bold uppercase tracking-wider block">Humidity</span>
                  <span className="text-base font-extrabold">{humidityVal}%</span>
                </div>

                {/* Wind Speed */}
                <div className="bg-[#112D2B] border border-emerald-900/40 p-4 rounded-xl text-center space-y-1">
                  <span className="text-2xl block">💨</span>
                  <span className="text-[10px] text-[#B0BEC5] font-bold uppercase tracking-wider block">Wind Speed</span>
                  <span className="text-base font-extrabold">{windVal} km/h</span>
                </div>

                {/* Rain Prob */}
                <div className="bg-[#112D2B] border border-emerald-900/40 p-4 rounded-xl text-center space-y-1">
                  <span className="text-2xl block">🌧️</span>
                  <span className="text-[10px] text-[#B0BEC5] font-bold uppercase tracking-wider block">Rain Prob.</span>
                  <span className="text-base font-extrabold">{rainProbVal}%</span>
                </div>

                {/* Condition */}
                <div className="bg-[#112D2B] border border-emerald-900/40 p-4 rounded-xl text-center space-y-1">
                  <span className="text-2xl block">☁️</span>
                  <span className="text-[10px] text-[#B0BEC5] font-bold uppercase tracking-wider block">Condition</span>
                  <span className="text-xs font-extrabold capitalize block truncate">{weatherCond}</span>
                </div>

                {/* Risk Level */}
                <div className="bg-[#112D2B] border border-emerald-900/40 p-4 rounded-xl text-center space-y-1">
                  <span className="text-2xl block">⚠️</span>
                  <span className="text-[10px] text-[#B0BEC5] font-bold uppercase tracking-wider block">Disease Risk</span>
                  <span className={`text-sm font-extrabold block ${
                    riskLevelVal === 'High' ? 'text-[#FF5252]' : riskLevelVal === 'Medium' ? 'text-[#FFC107]' : 'text-[#00C853]'
                  }`}>{riskLevelVal}</span>
                </div>
              </div>

              {/* Spray Suitability Banner */}
              <div className={`p-4 rounded-xl flex items-center justify-between border ${
                suitableSp === 'YES'
                  ? 'border-[#00C853]/40 bg-[#00C853]/10 text-[#00C853]'
                  : 'border-[#FFC107]/40 bg-[#FFC107]/10 text-[#FFC107]'
              }`}>
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🚿</span>
                  <div>
                    <p className="font-extrabold text-sm tracking-wide">SPRAYING STATUS FOR CHEMICALS/ORGANICS</p>
                    <p className="text-xs opacity-90 mt-0.5">
                      {suitableSp === 'YES'
                        ? 'Optimal weather parameters detected. Suitable for foliage spraying.'
                        : 'Suboptimal weather conditions or high disease risk. Spraying is not advised.'}
                    </p>
                  </div>
                </div>
                <span className="text-2xl font-black tracking-widest">{suitableSp}</span>
              </div>
            </div>
</>
)}

          </motion.div>
        )}
      </AnimatePresence>

      {/* 10. Prediction History Table */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
            <span>📅</span> Recent Prediction History
          </h2>
          <div className="h-0.5 bg-emerald-950/80 w-full mt-2" />
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center p-8 bg-[#112D2B]/30 border border-emerald-950 rounded-2xl">
            <FiLoader className="animate-spin text-[#00C853] text-2xl mr-3" />
            <span className="text-sm text-[#B0BEC5]">Loading historical data...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center bg-[#112D2B]/30 border border-dashed border-emerald-900/60 rounded-2xl text-[#B0BEC5]">
            No recent prediction records found on file.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-emerald-950/80 bg-[#112D2B]/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#112D2B]/80 text-[#B0BEC5] border-b border-emerald-950 font-semibold text-xs tracking-wider uppercase">
                  <th className="p-4">Image</th>
                  <th className="p-4">Crop</th>
                  <th className="p-4">Detected Disease</th>
                  <th className="p-4">Confidence</th>
                  <th className="p-4">Prediction Date</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-950/50 text-xs">
                {history.slice(0, 10).map((item) => (
                  <tr key={item.id} className="hover:bg-[#112D2B]/40 transition-colors">
                    <td className="p-4">
                      <div className="h-10 w-10 rounded-lg overflow-hidden border border-emerald-950 bg-black/30">
                        <img
                          src={`http://localhost:5000${item.uploaded_image}`}
                          alt="Leaf"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </td>
                    <td className="p-4 font-bold text-white">{item.crop_name}</td>
                    <td className="p-4 text-[#B0BEC5] font-semibold">{item.disease_name}</td>
                    <td className="p-4">
                      <span className={`font-bold ${getConfidenceTextColor(item.confidence)}`}>
                        {item.confidence.toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-4 text-[#B0BEC5]">
                      {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => loadHistoryItem(item)}
                        className="px-3.5 py-1.5 border border-[#00C853]/40 hover:border-[#00C853] bg-[#00C853]/15 hover:bg-[#00C853] text-[#00C853] hover:text-[#081C15] font-bold rounded-lg transition-all"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Reward Worker Modal */}
      {isRewardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#081C15] border border-emerald-500/30 rounded-2xl w-full max-w-md p-6 relative shadow-2xl"
          >
            <button 
              onClick={() => setIsRewardModalOpen(false)}
              className="absolute top-4 right-4 text-emerald-400 hover:text-emerald-300"
            >
              <FiX size={24} />
            </button>
            
            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
              <span className="text-emerald-400">🏆</span> Reward Worker
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#B0BEC5] mb-1">Select Worker</label>
                <select 
                  className="w-full bg-[#112D2B] border border-emerald-900/50 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500"
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                >
                  <option value="">-- Choose Worker --</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.full_name || w.username}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-[#B0BEC5] mb-1">Bonus Amount (₹)</label>
                <input 
                  type="number"
                  placeholder="e.g. 50"
                  className="w-full bg-[#112D2B] border border-emerald-900/50 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(e.target.value)}
                />
              </div>
              
              <button
                onClick={handleRewardWorker}
                disabled={isRewarding}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg transition-colors mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRewarding ? <FiLoader className="animate-spin" /> : <FiCheckCircle />}
                Confirm & Download Report
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
