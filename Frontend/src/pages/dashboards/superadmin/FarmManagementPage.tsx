import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionHeading } from '../../../components/ui/SectionHeading';
import { FiActivity, FiDroplet, FiLayers, FiMapPin } from 'react-icons/fi';

interface Field {
  id: string;
  farm_id?: string;
  field_name: string;
  field_code?: string;
  area?: number;
  soil_type?: string;
  irrigation_type?: string;
  location?: string;
  status?: string;
  crop_name?: string;
}

export default function FarmManagementPage() {
  const { t } = useTranslation();
  const [fields, setFields] = useState<Field[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const getToken = () => {
    const token = localStorage.getItem('token');
    return token && token.startsWith('"') ? token.slice(1, -1) : token;
  };

  useEffect(() => {
    const fetchFields = async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await fetch('/api/fields/farm/default', {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error('Failed to fetch fields');
        const data = await res.json();
        setFields(Array.isArray(data) ? data : data.fields || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch fields');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFields();
  }, []);

  const statusColor = (value?: string) =>
    value?.toLowerCase() === 'active'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : value?.toLowerCase() === 'inactive'
        ? 'bg-red-500/10 text-red-400 border-red-500/20'
        : 'bg-slate-500/10 text-slate-400 border-slate-500/20';

  const activeCount = fields.filter((field) => field.status?.toLowerCase() === 'active').length;
  const totalArea = fields.reduce((sum, field) => sum + (Number(field.area) || 0), 0);

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow={t('Farm Fields')}
        title={t('Field Management')}
        description={t('View field records from farm_fields. This page is read-only for administrators.')}
        tone="light"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: t('Total Fields'), value: fields.length, color: 'from-emerald-500 to-lime-400' },
          { label: t('Active Fields'), value: activeCount, color: 'from-green-600 to-emerald-400' },
          { label: t('With Crops'), value: fields.filter((f) => f.crop_name).length, color: 'from-teal-500 to-emerald-300' },
          { label: t('Total Area'), value: `${totalArea} ${t('Acres')}`, color: 'from-lime-500 to-green-300' },
        ].map((stat) => (
          <div key={String(stat.label)} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
            <div className={`bg-gradient-to-r ${stat.color} bg-clip-text text-2xl font-bold text-transparent`}>{stat.value}</div>
            <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">{t('Farm Fields')}</h2>
          <p className="mt-1 text-sm text-slate-400">Read-only view of fields from farm_fields.</p>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">{error}</div>}

        {isLoading ? (
          <div className="py-16 text-center text-slate-500">{t('Loading fields...')}</div>
        ) : fields.length === 0 ? (
          <div className="py-16 text-center">
            <FiMapPin className="mx-auto mb-4 text-4xl text-slate-600" />
            <p className="text-lg font-medium text-slate-400">{t('No fields yet')}</p>
            <p className="mt-1 text-sm text-slate-500">{t('No field records are available yet.')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-slate-950/80">
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">{t('Field')}</th>
                    <th className="px-4 py-3">{t('Farm')}</th>
                    <th className="px-4 py-3">{t('Area')}</th>
                    <th className="px-4 py-3">{t('Soil')}</th>
                    <th className="px-4 py-3">{t('Irrigation')}</th>
                    <th className="px-4 py-3">{t('Location')}</th>
                    <th className="px-4 py-3">{t('Crop')}</th>
                    <th className="px-4 py-3">{t('Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-slate-950/40">
                  {fields.map((field) => (
                    <tr key={field.id} className="align-top hover:bg-white/5">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">{field.field_name}</div>
                        <div className="mt-1 text-xs text-slate-500">ID: {field.id}</div>
                        {field.field_code ? <div className="mt-1 text-xs text-slate-500">Code: {field.field_code}</div> : null}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">{field.farm_id}</td>
                      <td className="px-4 py-4 text-sm text-slate-300">
                        <div className="flex items-center gap-2">
                          <FiActivity className="shrink-0 text-emerald-400" />
                          <span>{field.area ?? 'N/A'} {t('Acres')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">
                        <div className="flex items-center gap-2">
                          <FiLayers className="shrink-0 text-blue-400" />
                          <span>{field.soil_type || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">
                        <div className="flex items-center gap-2">
                          <FiDroplet className="shrink-0 text-cyan-400" />
                          <span>{field.irrigation_type || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">
                        <div className="flex items-center gap-2">
                          <FiMapPin className="shrink-0 text-amber-400" />
                          <span>{field.location || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">{field.crop_name || 'No active crop cycle'}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusColor(field.status)}`}>
                          {field.status || 'Unknown'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
