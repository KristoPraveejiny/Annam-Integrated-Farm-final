// Farm Manager Dashboard – extracted from DashboardPage.tsx
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiCheckCircle, FiUsers, FiAlertTriangle, FiActivity, FiSun, FiCloudRain, FiWind } from 'react-icons/fi';
import { useState, useEffect } from 'react';

type OverviewStats = {
  totalFields: number;
  activeFields: number;
  farmers: number;
  customers: number;
  products: number;
  orders: number;
  livestock: {
    total: number;
    healthy: number;
    feedingDue: number;
  };
  harvestAnalytics?: {
    cropsReady: number;
    harvestToday: number;
    harvestWeek: number;
    harvestMonth: number;
    harvestOverdue: number;
    totalArea: number;
    expectedYield: number;
  };
};

const emptyOverview: OverviewStats = {
  totalFields: 0,
  activeFields: 0,
  farmers: 0,
  customers: 0,
  products: 0,
  orders: 0,
  livestock: {
    total: 0,
    healthy: 0,
    feedingDue: 0,
  },
  harvestAnalytics: {
    cropsReady: 0,
    harvestToday: 0,
    harvestWeek: 0,
    harvestMonth: 0,
    harvestOverdue: 0,
    totalArea: 0,
    expectedYield: 0,
  }
};

const API_BASE_URL = '';

export default function FarmManagerDashboard() {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<OverviewStats>(emptyOverview);
  const [weatherData, setWeatherData] = useState<{temp: number | string, condition: string, advisory?: any}>({ temp: '29.0', condition: 'Partly Cloudy' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, weatherRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/dashboard/overview`, { headers: getAuthHeaders() }),
          fetch(`http://127.0.0.1:8000/api/weather-advisory/`).catch(() => null)
        ]);

        if (overviewRes.ok) {
          setOverview(await overviewRes.json());
        } else {
          console.error('Overview request failed:', overviewRes.status, await overviewRes.text());
        }

        if (weatherRes && weatherRes.ok) {
          const weatherJson = await weatherRes.json();
          if (weatherJson?.weather?.temperature !== undefined) {
            setWeatherData({
              temp: weatherJson.weather.temperature.toFixed(1),
              condition: weatherJson.weather.condition || 'Partly Cloudy',
              advisory: weatherJson.advisory
            });
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      }
    };

    fetchData();
  }, []);

  return (
    <>
      <SectionHeading eyebrow={t("Dashboard")} title={t("Farm Manager Overview")} description={t("Operations, workforce, and analytics for your farm.")} tone="light" />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <StatTile label={t('Total Fields')} value={formatCount(overview.totalFields)} />
        <StatTile label={t('Farmers')} value={formatCount(overview.farmers)} />
        <StatTile label={t('Customers')} value={formatCount(overview.customers)} />
        <StatTile label={t('Products')} value={formatCount(overview.products)} />
        <StatTile label={t('Orders')} value={formatCount(overview.orders)} />
      </div>



      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <Card title={t("Weather Forecast")} subtitle={t("Next 5 days")}>
          <div className="flex justify-between items-center bg-sky-900/40 p-6 rounded-2xl border border-sky-500/20 mb-6">
            <div>
              <p className="text-sm font-semibold text-sky-200">{t("TODAY")}</p>
              <h3 className="text-4xl font-bold text-white mt-2">{weatherData.temp}°C</h3>
              <p className="text-sky-300">{weatherData.condition}</p>
            </div>
            <div className="text-6xl text-amber-400">
              <FiSun />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { day: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][(new Date().getDay() + 1) % 7], temp: '29°', icon: <FiSun className="text-amber-400" /> },
              { day: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][(new Date().getDay() + 2) % 7], temp: '27°', icon: <FiCloudRain className="text-sky-400" /> },
              { day: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][(new Date().getDay() + 3) % 7], temp: '28°', icon: <FiSun className="text-amber-400" /> },
              { day: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][(new Date().getDay() + 4) % 7], temp: '26°', icon: <FiCloudRain className="text-sky-400" /> },
              { day: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][(new Date().getDay() + 5) % 7], temp: '25°', icon: <FiWind className="text-slate-400" /> },
            ].map((forecast, i) => (
              <div key={i} className="flex flex-col items-center p-3 bg-slate-900/50 rounded-xl border border-white/5">
                <span className="text-xs font-semibold text-slate-400 mb-2">{forecast.day}</span>
                <span className="text-2xl mb-2">{forecast.icon}</span>
                <span className="text-sm font-bold text-slate-200">{forecast.temp}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t("AI Farming Recommendations")} subtitle={t("Based on live weather and farm conditions")}>
          {weatherData.advisory ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-900/20 border border-emerald-500/20 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-emerald-400">💧 {t("Irrigation")}</h4>
                </div>
                <p className="text-sm text-slate-300">{weatherData.advisory.irrigation || t("Maintain normal watering schedules.")}</p>
              </div>
              
              <div className="p-4 bg-amber-900/20 border border-amber-500/20 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-amber-400">🌱 {t("Fertilizer")}</h4>
                </div>
                <p className="text-sm text-slate-300">{weatherData.advisory.fertilizer || t("Optimal time for nutrient application.")}</p>
              </div>

              <div className="p-4 bg-rose-900/20 border border-rose-500/20 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-rose-400">🛡️ {t("Pest & Disease")}</h4>
                </div>
                <p className="text-sm text-slate-300">{weatherData.advisory.pest_disease || t("Monitor crops for typical seasonal pests.")}</p>
              </div>

              <div className="p-4 bg-sky-900/20 border border-sky-500/20 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-sky-400">📋 {t("General Activities")}</h4>
                </div>
                <p className="text-sm text-slate-300">{weatherData.advisory.activities || t("Focus on crop maintenance and livestock health.")}</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-slate-400">
              {t("Loading AI Recommendations...")}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function getAuthHeaders() {
  const tokenRaw = localStorage.getItem('token');
  const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 via-transparent to-teal-500/10" />
      <div className="relative">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <p className="mt-3 text-4xl font-black text-slate-950">{value}</p>
        
      </div>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">{label}</div>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}


