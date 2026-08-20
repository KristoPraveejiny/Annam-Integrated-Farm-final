import { useEffect, useState } from 'react';
import { FiDroplet, FiScissors, FiSun, FiRefreshCw } from 'react-icons/fi';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { apiFetch } from '../../utils/apiFetch';
import { useTranslation } from 'react-i18next';

type Rule = { action: string; detail: string };
type IrrigationRule = Rule & { evapotranspiration_mm: number; rain_mm: number; deficit_mm: number };
type HarvestRule = Rule & { crops: { crop_name: string; variety: string | null; field: string | null; remaining_days: number | null }[] };

type DayAdvice = { irrigation: IrrigationRule; harvest: HarvestRule; planting: Rule };

type CropAdvice = {
  today: { weather: { temperature: number; humidity: number; description: string; windSpeed: number }; advice: DayAdvice };
  tomorrow: {
    weather: {
      date: string; temperature: number; max_temperature: number; min_temperature: number;
      humidity: number; windSpeed: number; rain_mm: number; rain_chance: number; description: string;
    };
    advice: DayAdvice;
  } | null;
  due_crops: { crop_name: string; remaining_days: number | null }[];
  narrative: {
    headline: string;
    today: { irrigation: string; harvest: string; planting: string };
    tomorrow: { irrigation: string; harvest: string; planting: string };
    priority_actions: string[];
  } | null;
};

// Each rule outcome gets a colour so the manager can scan the panel rather than read it.
const ACTION_TONES: Record<string, string> = {
  skip: 'text-sky-300',
  reduce: 'text-sky-300',
  normal: 'text-slate-200',
  increase: 'text-amber-300',
  harvest_now: 'text-rose-300',
  delay_drying: 'text-amber-300',
  good: 'text-emerald-300',
  none: 'text-slate-400',
  wait: 'text-rose-300',
  avoid: 'text-rose-300',
  irrigate_first: 'text-amber-300',
  fair: 'text-slate-200',
};

const label = (action: string) => action.replace(/_/g, ' ');

export function CropWeatherAdvicePanel() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<CropAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdvice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAdvice = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch(`/api/crops/weather-advice?language=${i18n.language || 'en'}`);
      if (!res.ok) throw new Error('request failed');
      setData(await res.json());
    } catch (err) {
      console.error('Failed to load crop advice', err);
      setError('Weather advice is unavailable right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={t('Weather-based field advice')}
      subtitle={t('Irrigation, harvest and planting guidance for today and tomorrow')}
      action={
        <Button variant="ghost" onClick={fetchAdvice} disabled={loading} className="!px-4 !py-2 text-xs">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          <span className="ml-2">{loading ? t('Checking...') : t('Refresh')}</span>
        </Button>
      }
    >
      {loading && !data ? (
        <p className="text-sm text-slate-300">{t('Reading the weather and checking your fields...')}</p>
      ) : error ? (
        <p className="text-sm text-amber-300">{error}</p>
      ) : !data ? null : (
        <div className="space-y-5">
          {data.narrative?.headline && (
            <p className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
              {data.narrative.headline}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <DayColumn
              heading={t('Today')}
              accent="emerald"
              weatherLine={`${Math.round(data.today.weather.temperature)}°C · ${data.today.weather.description} · ${t('Humidity')} ${Math.round(data.today.weather.humidity)}%`}
              advice={data.today.advice}
              narrative={data.narrative?.today}
              t={t}
            />
            {data.tomorrow ? (
              <DayColumn
                heading={t('Tomorrow')}
                accent="sky"
                weatherLine={`${Math.round(data.tomorrow.weather.min_temperature)}–${Math.round(data.tomorrow.weather.max_temperature)}°C · ${data.tomorrow.weather.description}${data.tomorrow.weather.rain_mm > 0 ? ` · ${data.tomorrow.weather.rain_mm} mm ${t('rain')}` : ''}`}
                advice={data.tomorrow.advice}
                narrative={data.narrative?.tomorrow}
                t={t}
              />
            ) : (
              <div className="grid place-items-center rounded-3xl border border-white/10 bg-slate-950/40 p-6 text-sm text-slate-400">
                {t('Tomorrow\'s forecast is unavailable.')}
              </div>
            )}
          </div>

          {data.narrative?.priority_actions && data.narrative.priority_actions.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">{t('Do first')}</p>
              <ol className="mt-3 space-y-2">
                {data.narrative.priority_actions.map((action, index) => (
                  <li key={index} className="flex gap-3 text-sm text-slate-200">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-300">
                      {index + 1}
                    </span>
                    <span>{action}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {!data.narrative && (
            <p className="text-xs text-slate-500">
              {t('AI explanation unavailable - the guidance above is calculated from weather rules.')}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function DayColumn({
  heading, accent, weatherLine, advice, narrative, t,
}: {
  heading: string;
  accent: 'emerald' | 'sky';
  weatherLine: string;
  advice: DayAdvice;
  narrative?: { irrigation: string; harvest: string; planting: string };
  t: (key: string) => string;
}) {
  const border = accent === 'emerald' ? 'border-emerald-400/25' : 'border-sky-400/25';
  const text = accent === 'emerald' ? 'text-emerald-300' : 'text-sky-300';

  return (
    <div className={`rounded-3xl border ${border} bg-slate-950/40 p-5`}>
      <div className="flex flex-wrap items-baseline gap-3">
        <p className={`text-xs font-bold uppercase tracking-[0.22em] ${text}`}>{heading}</p>
        <p className="text-sm capitalize text-slate-300">{weatherLine}</p>
      </div>

      <div className="mt-4 space-y-3">
        <AdviceRow
          icon={<FiDroplet />}
          title={t('Irrigation')}
          action={advice.irrigation.action}
          detail={narrative?.irrigation || advice.irrigation.detail}
          meta={`${t('Water loss')} ~${advice.irrigation.evapotranspiration_mm} mm · ${t('Rain')} ${advice.irrigation.rain_mm} mm`}
        />
        <AdviceRow
          icon={<FiScissors />}
          title={t('Harvest')}
          action={advice.harvest.action}
          detail={narrative?.harvest || advice.harvest.detail}
          meta={advice.harvest.crops.length > 0
            ? `${advice.harvest.crops.length} ${t('crops due')}: ${advice.harvest.crops.map((crop) => crop.crop_name).join(', ')}`
            : undefined}
        />
        <AdviceRow
          icon={<FiSun />}
          title={t('Planting')}
          action={advice.planting.action}
          detail={narrative?.planting || advice.planting.detail}
        />
      </div>
    </div>
  );
}

function AdviceRow({
  icon, title, action, detail, meta,
}: {
  icon: React.ReactNode;
  title: string;
  action: string;
  detail: string;
  meta?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-emerald-300">{icon}</span>
          <span className="text-sm font-bold text-white">{title}</span>
        </div>
        <span className={`text-[11px] font-bold uppercase tracking-wide ${ACTION_TONES[action] || 'text-slate-300'}`}>
          {label(action)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{detail}</p>
      {meta && <p className="mt-1.5 text-xs text-slate-500">{meta}</p>}
    </div>
  );
}
