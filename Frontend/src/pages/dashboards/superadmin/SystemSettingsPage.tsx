import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { getSystemSettings, updateSystemSetting, uploadSystemSettingImages } from '../../../api/admin';

type SettingRow = {
  setting_key: string;
  setting_value: any;
  scope: string;
  description?: string | null;
};

const resolveImageSrc = (value: string) => {
  if (!value) return '';
  if (value.startsWith('http') || value.startsWith('data:')) return value;
  if (value.startsWith('/uploads')) return `http://localhost:5000${encodeURI(value)}`;
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(value)) return `/${encodeURI(value)}`;
  return value;
};

const getImageLabel = (value: string) => {
  if (!value) return '';
  const rawName = value.split('/').pop() || value;
  return rawName.replace(/\.[^.]+$/, '');
};

const toDisplayName = (fileName: string, index: number) => {
  const nameWithoutExtension = fileName.replace(/\.[^.]+$/, '');
  const cleaned = nameWithoutExtension
    .replace(/^\d+-\d+-/,'')
    .replace(/^\d+-/,'')
    .replace(/[_-]+/g, ' ')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const base = words.length ? words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase() : 'Image';
  return index > 0 ? `${base} ${index + 1}` : base;
};

type ImageItem = {
  url: string;
  name: string;
};

const normalizeImageItems = (items: any, fallback: string[]): ImageItem[] => {
  const source = Array.isArray(items) && items.length ? items : fallback;
  return source
    .map((item) => {
      if (typeof item === 'string') {
        return { url: item, name: getImageLabel(item) };
      }
      if (item && typeof item === 'object') {
        const url = item.url || item.path || item.src || '';
        if (!url) return null;
        return { url, name: item.name || getImageLabel(url) };
      }
      return null;
    })
    .filter(Boolean) as ImageItem[];
};

export default function SystemSettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getSystemSettings();
      setSettings(data);
    } catch {
      setError('Failed to load system settings.');
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => ({
    home_hero: settings.find((item) => item.setting_key === 'home_hero' && item.scope === 'home'),
    home_about: settings.find((item) => item.setting_key === 'home_about' && item.scope === 'home'),
    about_page: settings.find((item) => item.setting_key === 'about_page' && item.scope === 'about'),
  }), [settings]);

  const saveSetting = async (setting_key: string, scope: string, setting_value: any, description?: string) => {
    try {
      setSavingKey(setting_key);
      const updated = await updateSystemSetting({ setting_key, scope, setting_value, description });
      setSettings((current) => {
        const remaining = current.filter((item) => !(item.setting_key === setting_key && item.scope === scope));
        return [...remaining, updated].sort((left, right) => `${left.scope}.${left.setting_key}`.localeCompare(`${right.scope}.${right.setting_key}`));
      });
    } catch {
      setError('Failed to save setting.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card title={t("System Settings")}>
        {loading ? <p className="p-4 text-slate-500">Loading settings...</p> : null}
        {error ? <p className="p-4 text-rose-600">{error}</p> : null}
        {!loading ? (
          <div className="space-y-6">
            <SettingEditor
              title="Home Hero"
              description="Controls the main banner text on the home page."
              value={grouped.home_hero?.setting_value?.headline || ''}
              body={grouped.home_hero?.setting_value?.subheadline || ''}
              onSave={(headline, subheadline) => saveSetting('home_hero', 'home', { headline, subheadline }, 'Home hero content')}
              saving={savingKey === 'home_hero'}
            />
            <SettingEditor
              title="Home About"
              description="Controls the about preview on the home page."
              value={grouped.home_about?.setting_value?.title || ''}
              body={grouped.home_about?.setting_value?.content || ''}
              onSave={(title, content) => saveSetting('home_about', 'home', { title, content }, 'Home about content')}
              saving={savingKey === 'home_about'}
            />
            <SettingEditor
              title="About Page"
              description="Controls the About Us hero and section headings."
              editor={
                <AboutPageEditor
                  initialValue={grouped.about_page?.setting_value || {}}
                  saving={savingKey === 'about_page'}
                  onSave={(value) => saveSetting('about_page', 'about', value, 'About page content')}
                />
              }
              saving={savingKey === 'about_page'}
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function SettingEditor({
  title,
  description,
  value,
  body,
  onSave,
  editor,
  saving,
}: {
  title: string;
  description: string;
  value?: string;
  body?: string;
  onSave?: (title: string, body: string) => void;
  editor?: ReactNode;
  saving: boolean;
}) {
  const [localTitle, setLocalTitle] = useState(value || '');
  const [localBody, setLocalBody] = useState(body || '');

  useEffect(() => setLocalTitle(value || ''), [value]);
  useEffect(() => setLocalBody(body || ''), [body]);

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-slate-950/60 to-slate-900/40 p-5 shadow-[0_18px_55px_rgba(2,6,23,0.18)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Section</p>
          <h3 className="mt-1 text-xl font-semibold text-white">{title}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
          Editable
        </div>
      </div>
      <div className="grid gap-3">
        {editor ? null : (
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-300">Title</span>
            <input
              className="farm-input rounded-xl"
              value={localTitle}
              onChange={(event) => setLocalTitle(event.target.value)}
              placeholder="Title"
            />
          </label>
        )}
        {editor ? editor : (
          <>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-300">Content</span>
              <textarea
                className="farm-input min-h-32 rounded-xl"
                value={localBody}
                onChange={(event) => setLocalBody(event.target.value)}
                placeholder="Content"
              />
            </label>
            <button
              type="button"
              onClick={() => onSave?.(localTitle, localBody)}
              disabled={saving}
              className="w-fit rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AboutPageEditor({
  initialValue,
  onSave,
  saving,
}: {
  initialValue: any;
  onSave: (value: any) => void;
  saving: boolean;
}) {
  const parseList = (items: any, fallback: string[]) => {
    if (Array.isArray(items)) {
      return items;
    }
    if (typeof items === 'string' && items.trim()) {
      return items.split('\n').map((item) => item.trim()).filter(Boolean);
    }
    return fallback;
  };

  const [value, setValue] = useState({
    hero_title: initialValue.hero_title || 'About Annam Integrated Farm',
    hero_subtitle: initialValue.hero_subtitle || 'Annam Integrated Farm combines traditional knowledge with modern techniques to grow quality produce and manage healthy livestock.',
    live_stock_title: initialValue.live_stock_title || 'Live Stock',
    live_stock_subtitle: initialValue.live_stock_subtitle || 'Scenes of our healthy animals.',
    live_stock_images: normalizeImageItems(initialValue.live_stock_images, ['duck.png', 'cow.jpeg', 'hen.jpeg', 'hen2.png']),
    crops_title: initialValue.crops_title || 'Crops',
    crops_subtitle: initialValue.crops_subtitle || 'Diverse crops cultivated on our farm.',
    crops_images: normalizeImageItems(initialValue.crops_images, ['Banana plant.webp', 'Green-beans.webp', 'green-chilli-plant.webp', 'ladies finger image.jpg', 'paddy field.jpg', 'Papaya-crop.jpg', 'Peanut leaf.jpeg', 'Tomato leaf.jpg']),
    products_title: initialValue.products_title || 'Our Products',
    products_subtitle: initialValue.products_subtitle || 'Fresh produce and products from our farm.',
    products_images: normalizeImageItems(initialValue.products_images, ['banana image.jpg', 'beans.jpg', 'Brown-eggs.webp', 'green chilli.webp', 'ladies finger food.jpeg', 'papaw.png', 'tomato.jpg']),
  });
  const [uploading, setUploading] = useState<string | null>(null);

  const uploadImages = async (field: 'live_stock_images' | 'crops_images' | 'products_images', files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      setUploading(field);
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append(field, file));
      const result = await uploadSystemSettingImages(formData);
      const uploaded = result.files?.[field] || [];
      const normalized = uploaded
        .map((item: string) => (typeof item === 'string' ? item : ''))
        .filter(Boolean);
      setValue((current) => ({
        ...current,
        [field]: [
          ...current[field],
          ...normalized.map((item: string, index: number) => ({ url: item, name: toDisplayName(getImageLabel(item), index) })),
        ],
      }));
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="grid gap-5">
      <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 shadow-[0_10px_35px_rgba(2,6,23,0.12)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">About Page Content</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">Edit the hero copy, section headings, and the image galleries shown on the public About page.</p>
      </div>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-300">Hero title</span>
        <input className="farm-input rounded-xl" value={value.hero_title} onChange={(event) => setValue((current) => ({ ...current, hero_title: event.target.value }))} placeholder="Hero title" />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-300">Hero subtitle</span>
        <textarea className="farm-input min-h-24 rounded-xl" value={value.hero_subtitle} onChange={(event) => setValue((current) => ({ ...current, hero_subtitle: event.target.value }))} placeholder="Hero subtitle" />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-300">Live stock title</span>
        <input className="farm-input rounded-xl" value={value.live_stock_title} onChange={(event) => setValue((current) => ({ ...current, live_stock_title: event.target.value }))} placeholder="Live stock title" />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-300">Live stock subtitle</span>
        <input className="farm-input rounded-xl" value={value.live_stock_subtitle} onChange={(event) => setValue((current) => ({ ...current, live_stock_subtitle: event.target.value }))} placeholder="Live stock subtitle" />
      </label>
      <UploadList
        label="Live stock images"
        values={value.live_stock_images}
        onRemove={(index) => setValue((current) => ({ ...current, live_stock_images: current.live_stock_images.filter((_, currentIndex) => currentIndex !== index) }))}
        onRename={(index, name) => setValue((current) => ({ ...current, live_stock_images: current.live_stock_images.map((item, currentIndex) => currentIndex === index ? { ...item, name } : item) }))}
        onUpload={(files) => uploadImages('live_stock_images', files)}
        uploading={uploading === 'live_stock_images'}
      />
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-300">Crops title</span>
        <input className="farm-input rounded-xl" value={value.crops_title} onChange={(event) => setValue((current) => ({ ...current, crops_title: event.target.value }))} placeholder="Crops title" />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-300">Crops subtitle</span>
        <input className="farm-input rounded-xl" value={value.crops_subtitle} onChange={(event) => setValue((current) => ({ ...current, crops_subtitle: event.target.value }))} placeholder="Crops subtitle" />
      </label>
      <UploadList
        label="Crops images"
        values={value.crops_images}
        onRemove={(index) => setValue((current) => ({ ...current, crops_images: current.crops_images.filter((_, currentIndex) => currentIndex !== index) }))}
        onRename={(index, name) => setValue((current) => ({ ...current, crops_images: current.crops_images.map((item, currentIndex) => currentIndex === index ? { ...item, name } : item) }))}
        onUpload={(files) => uploadImages('crops_images', files)}
        uploading={uploading === 'crops_images'}
      />
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-300">Products title</span>
        <input className="farm-input rounded-xl" value={value.products_title} onChange={(event) => setValue((current) => ({ ...current, products_title: event.target.value }))} placeholder="Products title" />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-300">Products subtitle</span>
        <input className="farm-input rounded-xl" value={value.products_subtitle} onChange={(event) => setValue((current) => ({ ...current, products_subtitle: event.target.value }))} placeholder="Products subtitle" />
      </label>
      <UploadList
        label="Products images"
        values={value.products_images}
        onRemove={(index) => setValue((current) => ({ ...current, products_images: current.products_images.filter((_, currentIndex) => currentIndex !== index) }))}
        onRename={(index, name) => setValue((current) => ({ ...current, products_images: current.products_images.map((item, currentIndex) => currentIndex === index ? { ...item, name } : item) }))}
        onUpload={(files) => uploadImages('products_images', files)}
        uploading={uploading === 'products_images'}
      />
      <button
        type="button"
        onClick={() => onSave({
          ...value,
        })}
        disabled={saving}
        className="w-fit rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function UploadList({
  label,
  values,
  onRemove,
  onRename,
  onUpload,
  uploading,
}: {
  label: string;
  values: ImageItem[];
  onRemove: (index: number) => void;
  onRename: (index: number, name: string) => void;
  onUpload: (files: FileList | null) => void;
  uploading: boolean;
}) {
  return (
    <div className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-slate-950/50 to-slate-900/35 p-4 shadow-[0_12px_40px_rgba(2,6,23,0.15)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="block text-sm font-semibold text-white">{label}</span>
          <span className="text-xs text-slate-400">Upload images from your device. Multiple files are allowed.</span>
        </div>
        <label className="cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-teal-400">
          {uploading ? 'Uploading...' : 'Upload Images'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => onUpload(event.target.files)} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {values.length ? values.map((item, index) => (
          <div key={`${label}-${item.url}-${index}`} className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-slate-950/55 shadow-[0_12px_30px_rgba(2,6,23,0.16)]">
            <div className="relative aspect-[16/10] bg-slate-900">
              <img src={resolveImageSrc(item.url)} alt={item.name} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 to-transparent px-3 py-2">
                <p className="truncate text-xs font-medium text-white/90">{item.name || getImageLabel(item.url)}</p>
              </div>
            </div>
            <div className="space-y-3 px-3 py-3">
              <input
                value={item.name}
                onChange={(event) => onRename(index, event.target.value)}
                placeholder="Enter image name"
                className="farm-input rounded-xl px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Ready</span>
                <button type="button" className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20" onClick={() => onRemove(index)}>Remove</button>
              </div>
            </div>
          </div>
        )) : <p className="text-sm text-slate-500">No images uploaded yet.</p>}
      </div>
    </div>
  );
}
