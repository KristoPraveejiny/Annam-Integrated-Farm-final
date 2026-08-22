import { useTranslation } from 'react-i18next';
import { FiAlertTriangle, FiFileText } from 'react-icons/fi';

export type DiseaseReport = {
  id: string;
  title?: string;
  description?: string;
  severity?: string;
  status?: string;
  crop_name?: string;
  field_name?: string;
  affected_plants?: number | null;
  image_urls?: string[] | null;
  manager_notes?: string | null;
  reported_at?: string;
};

/**
 * Uploads are served by the API, not the dev server, so a stored path needs the
 * backend origin; anything already absolute is left alone.
 */
function resolveImage(url: string) {
  if (/^(https?:|blob:|data:)/.test(url)) return url;
  return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
}

const severityTone = (severity?: string) => {
  const s = String(severity || '').toLowerCase();
  if (s === 'high' || s === 'critical') return 'bg-red-500/10 text-red-300 border-red-500/30';
  if (s === 'medium') return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
};

/**
 * The originating disease report, shown on a task that was raised from one, so
 * whoever works the task can see the reported symptoms and photo rather than
 * only the task title.
 */
export function DiseaseReportPanel({
  report,
  attachmentUrl,
  attachmentName
}: {
  report: DiseaseReport;
  /** Manager's report PDF handed over with the task, if one was attached. */
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}) {
  const { t } = useTranslation();
  const images = Array.isArray(report.image_urls) ? report.image_urls : [];

  return (
    <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 font-normal">
      <div className="flex flex-wrap items-center gap-2">
        <FiAlertTriangle className="shrink-0 text-amber-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
          {t('Disease Report')}
        </span>
        {report.severity && (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${severityTone(report.severity)}`}>
            {report.severity}
          </span>
        )}
      </div>

      {report.title && <p className="mt-2 text-sm font-semibold text-white">{report.title}</p>}

      {(report.crop_name || report.field_name) && (
        <p className="mt-0.5 text-xs text-slate-400">
          {[report.crop_name, report.field_name].filter(Boolean).join(' | ')}
        </p>
      )}

      {report.description && (
        <p className="mt-2 whitespace-pre-line text-xs text-slate-300">{report.description}</p>
      )}

      {typeof report.affected_plants === 'number' && (
        <p className="mt-1 text-xs text-slate-400">
          {t('Affected plants')}: <span className="text-slate-200">{report.affected_plants}</span>
        </p>
      )}

      {report.manager_notes && (
        <p className="mt-2 text-xs text-slate-300">
          <span className="font-semibold text-emerald-300">{t('Manager notes')}: </span>
          {report.manager_notes}
        </p>
      )}

      {images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((url, index) => (
            <a key={index} href={resolveImage(url)} target="_blank" rel="noreferrer">
              <img
                src={resolveImage(url)}
                alt={t('Reported symptom')}
                className="h-20 w-20 rounded-lg border border-white/10 object-cover transition-transform hover:scale-105"
              />
            </a>
          ))}
        </div>
      )}

      {attachmentUrl && (
        <a
          href={resolveImage(attachmentUrl)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
        >
          <FiFileText />
          {attachmentName || t('Open report PDF')}
        </a>
      )}

      {report.reported_at && (
        <p className="mt-2 text-[10px] text-slate-500">
          {t('Reported')}: {new Date(report.reported_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
