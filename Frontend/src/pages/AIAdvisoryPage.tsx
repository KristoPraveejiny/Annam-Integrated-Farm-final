import { useState, useEffect } from 'react';
import { FiAlertTriangle, FiUploadCloud, FiCloud, FiThermometer, FiDroplet, FiWind, FiCompass } from 'react-icons/fi';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';

interface WeatherData {
  temperature: number;
  humidity: number;
  condition: string;
  description: string;
  wind_speed: number;
  rain_prob: number;
  icon: string;
  city: string;
  last_updated: string;
}

interface AdvisoryData {
  explanation: string;
  irrigation: string;
  fertilizer: string;
  pest_disease: string;
  activities: string;
  score: number;
  alerts: string[];
}

export default function AIAdvisoryPage() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [advisory, setAdvisory] = useState<AdvisoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdvisory = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/weather-advisory/');
        if (!response.ok) {
          throw new Error('Failed to fetch weather forecast');
        }
        const data = await response.json();
        setWeather(data.weather);
        setAdvisory(data.advisory);
      } catch (err: any) {
        setError(err.message || 'Error loading forecast');
      } finally {
        setLoading(false);
      }
    };
    fetchAdvisory();
  }, []);

  return (
    <div className="section-shell py-10">
      <SectionHeading
        eyebrow="AI Advisory"
        title="Futuristic farm intelligence"
        description="A smart assistant that combines weather, disease risk, and crop planning into a sleek AI-powered workflow."
        tone="light"
      />

      <div className="grid gap-6">
        {/* ── Weather & Recommendations Grid ── */}
        <div className="grid gap-6">
          {/* Live Weather Forecast Widget */}
          <Card title={`Live Weather Forecast - ${weather?.city || 'Neeliyamodai, Vavuniya'}`} subtitle="Real-time OpenWeather updates">
            {loading ? (
              <div className="flex items-center justify-center p-6 text-slate-400">
                <FiCloud className="animate-bounce mr-2 text-2xl text-emerald-400" />
                <span>Fetching live forecast...</span>
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-red-400 bg-red-950/20 border border-red-500/20 rounded-2xl">
                Unable to load real-time weather details: {error}
              </div>
            ) : weather && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-white/5 p-4 border border-white/5">
                  <div className="flex items-center gap-4">
                    <img 
                      src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`} 
                      alt={weather.condition}
                      className="w-16 h-16 bg-emerald-500/10 rounded-full border border-emerald-500/20"
                    />
                    <div>
                      <h4 className="text-2xl font-bold text-slate-100">{weather.temperature.toFixed(1)}°C</h4>
                      <p className="text-sm font-semibold capitalize text-emerald-400">{weather.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full uppercase">
                      {weather.condition}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-2">
                      Updated: {new Date(weather.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 p-3 border border-white/5">
                    <FiDroplet className="text-emerald-400 text-lg mb-1" />
                    <span className="text-xs text-slate-400">Humidity</span>
                    <span className="text-sm font-bold text-slate-200">{weather.humidity}%</span>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 p-3 border border-white/5">
                    <FiWind className="text-emerald-400 text-lg mb-1" />
                    <span className="text-xs text-slate-400">Wind</span>
                    <span className="text-sm font-bold text-slate-200">{weather.wind_speed} m/s</span>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 p-3 border border-white/5">
                    <FiCompass className="text-emerald-400 text-lg mb-1" />
                    <span className="text-xs text-slate-400">Precipitation</span>
                    <span className="text-sm font-bold text-slate-200">{weather.rain_prob} mm</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Weather-based Recommendations */}
          <Card title="Weather-based recommendations" subtitle={`Farming advice - Suitability Score: ${advisory?.score || 75}%`}>
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse h-12 bg-white/5 border border-white/5 rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm">
                  <p className="font-semibold text-emerald-300 mb-1">🚿 Irrigation</p>
                  <p className="text-xs text-slate-300">{advisory?.irrigation}</p>
                </div>
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm">
                  <p className="font-semibold text-emerald-300 mb-1">🧪 Fertilizing</p>
                  <p className="text-xs text-slate-300">{advisory?.fertilizer}</p>
                </div>
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm">
                  <p className="font-semibold text-emerald-300 mb-1">🐛 Pest Advisory</p>
                  <p className="text-xs text-slate-300">{advisory?.pest_disease}</p>
                </div>
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm">
                  <p className="font-semibold text-emerald-300 mb-1">🚜 Recommended Tasks</p>
                  <p className="text-xs text-slate-300">{advisory?.activities}</p>
                </div>
              </div>
            )}
          </Card>


          {/* Risk Alerts Card */}
          <Card title="Risk alerts" subtitle="Important signals">
            {loading ? (
              <div className="space-y-3">
                <div className="animate-pulse h-16 bg-white/5 border border-white/5 rounded-2xl" />
              </div>
            ) : advisory && advisory.alerts && advisory.alerts.length > 0 ? (
              <div className="space-y-3">
                {advisory.alerts.map((alert) => {
                  let desc = "Condition matches warning thresholds.";
                  if (alert === "Irrigation Reminder") desc = "Low precipitation expected. Ensure active irrigation cycles.";
                  if (alert === "High Temperature") desc = "Protect young crops from sunburn and stress.";
                  if (alert === "Heavy Rain") desc = "Manage farm drainage and prevent waterlogging.";
                  if (alert === "Strong Wind") desc = "Secure structural tunnels and crop supports.";
                  return (
                    <RiskCard key={alert} title={alert} description={desc} />
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100/10 bg-white/5 p-4 text-sm text-slate-400">
                No active weather risks or alert warnings for Neeliyamodai today.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function RiskCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100/10 bg-white/5 p-4">
      <FiAlertTriangle className="mt-1 text-amber-400 shrink-0" />
      <div>
        <p className="font-semibold text-slate-200">{title}</p>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
    </div>
  );
}

