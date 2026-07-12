import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { useTranslation } from 'react-i18next';
import { FiLoader, FiAlertCircle, FiCalendar, FiCloudRain, FiCheckCircle } from 'react-icons/fi';

interface WeatherSummary {
  temperature: number;
  description: string;
}

interface AiRecommendation {
  disease_explanation: string;
  possible_causes: string[];
  organic_treatment: string[];
  chemical_treatment: string[];
  immediate_action?: string[];
  future_prevention?: string[];
  weather_based_advice: string;
}

interface HistoryItem {
  id: string;
  crop_name: string;
  disease_name: string;
  confidence: number;
  uploaded_image: string;
  weather_summary: WeatherSummary;
  ai_recommendation: AiRecommendation;
  created_at: string;
}


export default function DiseaseHistoryPage() {
  const { t } = useTranslation();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/ai/disease-history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setHistory(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading history');
    } finally {
      setLoading(false);
    }
  };

  const API_BASE_URL = 'http://localhost:5000'; // Make sure images resolve correctly

  return (
    <div className="section-shell py-10">
      <SectionHeading
        eyebrow={t("History")}
        title={t("Disease Detection History")}
        description={t("Review past AI diagnoses and recommendations for your farm.")}
        tone="light"
      />

      {loading && (
        <div className="flex justify-center items-center py-20">
          <FiLoader className="animate-spin text-4xl text-emerald-600" />
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 flex gap-2 mb-6">
          <FiAlertCircle size={20} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && history.length === 0 && (
        <div className="text-center py-10 border border-dashed rounded-3xl bg-slate-50 text-slate-500">
          No disease detection history found.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {history.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <div className="relative h-48 -mx-5 -mt-5 mb-4 bg-slate-100">
              <img
                src={`${API_BASE_URL}${item.uploaded_image}`}
                alt="Crop"
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-emerald-50">{item.crop_name}</h3>
                  <p className="text-sm font-medium text-emerald-400 flex items-center gap-1">
                    <FiCheckCircle /> {item.disease_name}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-full">
                    {item.confidence}%
                  </span>
                </div>
              </div>

              <p className="text-xs text-emerald-100/60 flex items-center gap-1">
                <FiCalendar /> {new Date(item.created_at).toLocaleString()}
              </p>

              {item.weather_summary && (
                <div className="bg-[#0b1c16] border border-emerald-500/20 text-emerald-100/90 text-xs p-2 rounded flex items-center gap-2">
                  <FiCloudRain />
                  <span>{item.weather_summary.temperature}°C, {item.weather_summary.description}</span>
                </div>
              )}

              {item.ai_recommendation && (
                <div className="mt-3 pt-3 border-t border-emerald-500/10 text-sm">
                  <p className="text-emerald-100/80 line-clamp-3 font-medium">
                    {item.ai_recommendation.disease_explanation}
                  </p>

                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="mt-2 text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors"
                  >
                    {expandedIds.includes(item.id) ? 'Hide details' : 'View full report'}
                  </button>

                  {expandedIds.includes(item.id) && (
                    <div className="mt-4 space-y-3 pt-3 border-t border-emerald-500/10 animate-[fadeIn_0.3s_ease-out]">
                      {item.ai_recommendation.possible_causes && (
                        <div>
                          <p className="font-bold text-emerald-50">Possible Causes</p>
                          <ul className="list-disc list-inside text-xs text-emerald-100/70 mt-1 space-y-0.5">
                            {item.ai_recommendation.possible_causes.map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-2 pt-1">
                        <div>
                          <p className="font-bold text-emerald-200 text-xs bg-emerald-900/40 border border-emerald-500/20 px-2 py-1 rounded inline-block">Organic Treatment</p>
                          <ul className="list-disc list-inside text-xs text-emerald-100/70 mt-1 space-y-0.5">
                            {item.ai_recommendation.organic_treatment.map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                        <div className="pt-1">
                          <p className="font-bold text-red-200 text-xs bg-red-900/30 border border-red-500/20 px-2 py-1 rounded inline-block">Chemical Treatment</p>
                          <ul className="list-disc list-inside text-xs text-red-100/70 mt-1 space-y-0.5">
                            {item.ai_recommendation.chemical_treatment.map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 pt-1">
                        {item.ai_recommendation.immediate_action && (
                          <div>
                            <p className="font-bold text-purple-200 text-xs bg-purple-900/30 border border-purple-500/20 px-2 py-1 rounded inline-block">Immediate Action</p>
                            <ul className="list-disc list-inside text-xs text-purple-100/70 mt-1 space-y-0.5">
                              {item.ai_recommendation.immediate_action.map((t, i) => <li key={i}>{t}</li>)}
                            </ul>
                          </div>
                        )}
                        {item.ai_recommendation.future_prevention && (
                          <div className="pt-1">
                            <p className="font-bold text-cyan-200 text-xs bg-cyan-900/30 border border-cyan-500/20 px-2 py-1 rounded inline-block">Prevention Steps</p>
                            <ul className="list-disc list-inside text-xs text-cyan-100/70 mt-1 space-y-0.5">
                              {item.ai_recommendation.future_prevention.map((t, i) => <li key={i}>{t}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-emerald-500/10">
                        <p className="font-bold text-emerald-50">Weather-based Advice</p>
                        <p className="text-xs text-emerald-100/70 mt-1">{item.ai_recommendation.weather_based_advice}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
