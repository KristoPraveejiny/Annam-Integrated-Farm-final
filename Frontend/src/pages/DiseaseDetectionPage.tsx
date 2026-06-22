import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import {
  FiDownload, FiUploadCloud, FiTrash2, FiAlertCircle,
  FiLoader, FiCheckCircle, FiInfo
} from 'react-icons/fi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeading } from '../components/ui/SectionHeading';
import { useTranslation } from 'react-i18next';

interface AnalysisResult {
  disease: string;
  confidence: string;
  recommendation_steps: string[];
}

// ── Supported Crop Types ─────────────────────────────────────────
const SUPPORTED_CROPS = [
  { name: 'Tomato', emoji: '🍅' },
  { name: 'Papaw (Papaya)', emoji: '🥭' },
  { name: 'Coconut', emoji: '🥥' },
  { name: 'Paddyfield (Rice)', emoji: '🌾' },
];

export default function DiseaseDetectionPage() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setError(null);
    setResult(null);
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    uploadAndAnalyze(selectedFile);
  };

  const uploadAndAnalyze = async (selectedFile: File) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await fetch('http://localhost:8000/api/predict/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const data: AnalysisResult = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error('API Error:', err);
      setError(
        err.message ||
        'Failed to connect to the AI model server. Ensure the Django API server is running on http://127.0.0.1:8000.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
  };
  const handleBoxClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processFile(e.target.files[0]);
  };
  const handleClear = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Confidence level helper
  const getConfidenceNum = () =>
    result ? parseFloat(result.confidence.replace('%', '')) : 0;

  const isLowConfidence = () => getConfidenceNum() < 70;

  // Report download
  const downloadReport = () => {
    if (!result) return;
    const steps = result.recommendation_steps ?? [];
    const reportText = `Smart Farm Management & Advisory System
Crop Disease Analysis Report
--------------------------------------
Image File   : ${file?.name || 'Uploaded Leaf'}
Detected     : ${result.disease}
Confidence   : ${result.confidence}

Recommended Treatment Actions:
${steps.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}
--------------------------------------
⚠  NOTE: This AI model is trained on specific crops (Tomato, Papaw, Coconut, Paddyfield).
   Results for other crops may be inaccurate. Always verify with a local agronomist.
--------------------------------------
Generated on ${new Date().toLocaleString()}`;

    const element = document.createElement('a');
    element.href = URL.createObjectURL(new Blob([reportText], { type: 'text/plain' }));
    element.download = `${result.disease.replace(/\s+/g, '_')}_Report.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const isHealthy = result?.disease.toLowerCase().includes('healthy');

  return (
    <div className="section-shell py-10">
      <SectionHeading
        eyebrow={t("Disease Detection")}
        title={t("Crop Disease Detection")}
        description={t("Upload a crop leaf image to receive AI-powered disease diagnosis and treatment recommendations.")}
        tone="light"
      />

      {/* ── Supported Crops Notice ─────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <FiInfo className="mt-0.5 shrink-0 text-lg text-blue-600" />
          <div>
            <p className="font-semibold text-blue-800">{t("Supported Crop Types")}</p>
            <p className="mt-0.5 text-sm text-blue-700">
              {t("This AI model is trained on the PlantVillage dataset and can only detect diseases for the following crops. Uploading a leaf from a different plant may give incorrect results.")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUPPORTED_CROPS.map((crop) => (
                <span
                  key={crop.name}
                  className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-800"
                >
                  <span>{crop.emoji}</span> {crop.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* ── Left: Upload Area ─────────────────────────────────────────── */}
        <Card title={t("Image Upload")} subtitle={t("Drag and drop area")}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBoxClick}
            className={`grid cursor-pointer place-items-center rounded-[2rem] border-2 border-dashed p-10 text-center transition duration-300 ${
              isDragging
                ? 'border-emerald-500 bg-emerald-100 scale-[1.01]'
                : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/70'
            }`}
          >
            <FiUploadCloud
              className={`text-6xl transition duration-300 ${isDragging ? 'text-emerald-700 animate-bounce' : 'text-emerald-600'}`}
            />
            <p className="mt-4 text-lg font-bold text-slate-900">{t("Drag and drop crop leaf image here")}</p>
            <p className="mt-2 text-sm text-slate-600">
              {t("Supported: JPG, PNG, high-resolution field photos.")}
            </p>
            <p className="mt-1 text-xs text-amber-600 font-medium">
              ⚠ {t("Only upload leaves from the supported crop types listed above.")}
            </p>
            <Button
              theme="light"
              variant="primary"
              className="mt-5"
              onClick={(e) => { e.stopPropagation(); handleBoxClick(); }}
            >
              {t("Choose File")}
            </Button>
          </div>
        </Card>

        {/* ── Right: Preview + Results ──────────────────────────────────── */}
        <div className="space-y-6">
          {/* Preview */}
          <Card title={t("Preview Image")} subtitle={t("Selected file preview")}>
            <div className="relative flex h-56 w-full items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-100 via-lime-50 to-white border border-emerald-100">
              {previewUrl ? (
                <>
                  <img src={previewUrl} alt="Uploaded leaf preview" className="h-full w-full object-cover" />
                  <button
                    onClick={handleClear}
                    className="absolute right-4 top-4 rounded-full bg-red-500 p-2 text-white shadow-md hover:bg-red-600 transition"
                    title="Remove Image"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-500">{t("No image selected. Upload a crop leaf photo to start.")}</p>
              )}
            </div>
          </Card>

          {/* AI Analysis */}
          <Card title={t("AI Analysis")} subtitle={t("Disease detection result")}>
            <div className="space-y-4">

              {/* Loading */}
              {loading && (
                <div className="space-y-4 py-4 text-center">
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-full origin-left animate-[pulse_1.5s_infinite] rounded-full bg-emerald-500" />
                  </div>
                  <div className="flex items-center justify-center gap-2 text-emerald-700 font-semibold animate-pulse">
                    <FiLoader className="animate-spin text-lg" />
                    <span>Analyzing crop health with AI...</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-700">
                  <div className="flex gap-2.5 items-start">
                    <FiAlertCircle size={20} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Analysis Failed</p>
                      <p className="mt-1 text-sm leading-relaxed">{error}</p>
                      <p className="mt-2 text-xs text-red-500">
                        Make sure the Django AI server is running: <code className="bg-red-100 px-1 rounded">python manage.py runserver 8000</code>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Result */}
              {result && (
                <div className="space-y-4 animate-[fadeIn_0.5s_ease-out]">

                  {/* Outcome box */}
                  <div className={`rounded-3xl p-5 border ${
                    isHealthy
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      {isHealthy
                        ? <FiCheckCircle className="text-xl text-emerald-600" />
                        : <FiAlertCircle className="text-xl text-amber-600" />}
                      <p className="text-md font-bold">Detected: {result.disease}</p>
                    </div>
                    <p className="mt-2 text-sm">
                      Model Confidence: <strong>{result.confidence}</strong>
                    </p>
                  </div>

                  {/* ⚠ Low-confidence OR out-of-scope warning */}
                  {isLowConfidence() && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm flex gap-2 items-start">
                      <FiAlertCircle className="shrink-0 mt-0.5" />
                      <span>
                        <strong>Low confidence result.</strong> The AI is not certain about this prediction.
                        Please verify with a trained agronomist.
                      </span>
                    </div>
                  )}

                  {/* General disclaimer for out-of-scope crops */}
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-blue-800 text-xs flex gap-2 items-start">
                    <FiInfo className="shrink-0 mt-0.5 text-blue-600" size={14} />
                    <span>
                      <strong>Important:</strong> This model only recognises diseases in the supported crops listed above.
                      If your plant is <em>not</em> in the supported list (e.g., cucumber, pumpkin, beans),
                      the result shown may be <strong>incorrect</strong>. Always cross-check with a local agronomist.
                    </span>
                  </div>

                  {/* Recommendations */}
                  {(result.recommendation_steps?.length ?? 0) > 0 && (
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="font-bold text-slate-900">Recommended Treatment Actions</p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-600 leading-relaxed">
                        {result.recommendation_steps.map((item, idx) => (
                          <li key={idx} className="flex gap-2 items-start">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                              {idx + 1}
                            </span>
                            <span>{item.replace(/^\d+\.\s*/, '')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button
                    theme="light"
                    variant="secondary"
                    className="w-full gap-2 mt-2"
                    onClick={downloadReport}
                  >
                    <FiDownload /> Download Report
                  </Button>
                </div>
              )}

              {/* Idle */}
              {!loading && !error && !result && (
                <div className="py-6 text-center border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                  <p className="text-sm text-slate-500">
                    Upload a leaf photo from a supported crop type. The AI diagnostic and treatment card will appear here.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}