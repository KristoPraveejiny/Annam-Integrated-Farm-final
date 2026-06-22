import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { Button } from '../../components/ui/Button';
import { FiPlus, FiMapPin, FiDroplet, FiLayers, FiActivity, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

interface Field {
  id: string;
  field_name: string;
  field_code: string;
  area: number;
  soil_type: string;
  irrigation_type: string;
  location: string;
  status: string;
  crop_name?: string;
  growth_stage?: string;
  crop_status?: string;
}

const SOIL_TYPES = ['Loamy Soil', 'Clay Soil', 'Sandy Soil', 'Silt Soil', 'Peaty Soil', 'Chalky Soil', 'Other'];
const IRRIGATION_TYPES = ['Drip Irrigation', 'Sprinkler', 'Surface', 'Flood', 'None'];

export default function FieldManagementPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [fields, setFields] = useState<Field[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editField, setEditField] = useState<Field | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emptyForm = { field_name: '', field_code: '', area: '', soil_type: '', irrigation_type: '', location: '', status: 'Active' };
  const [formData, setFormData] = useState<any>(emptyForm);

  const getToken = () => {
    const t = localStorage.getItem('token');
    return t && t.startsWith('"') ? t.slice(1, -1) : t;
  };

  const fetchFields = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/fields/farm/default', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Failed to fetch fields');
      const data = await res.json();
      setFields(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchFields(); }, []);

  const openAdd = () => { setEditField(null); setFormData(emptyForm); setIsModalOpen(true); };
  const openEdit = (f: Field) => {
    setEditField(f);
    setFormData({ field_name: f.field_name, field_code: f.field_code || '', area: f.area || '', soil_type: f.soil_type || '', irrigation_type: f.irrigation_type || '', location: f.location || '', status: f.status || 'Active' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = editField ? `/api/fields/${editField.id}` : '/api/fields';
      const method = editField ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, area: parseFloat(formData.area) || null })
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Failed to save field');
      }
      setIsModalOpen(false);
      setFormData(emptyForm);
      fetchFields();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete field "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/fields/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Failed to delete field');
      fetchFields();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const statusColor = (s: string) =>
    s?.toLowerCase() === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : s?.toLowerCase() === 'inactive' ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : 'bg-slate-500/10 text-slate-400 border-slate-500/20';

  const cropStatusColor = (s: string) =>
    s === 'growing' ? 'text-emerald-400' : s === 'planned' ? 'text-blue-400' : s === 'harvesting' ? 'text-amber-400' : 'text-slate-400';

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow={t("Farm Fields")}
        title={t("Field Management")}
        description={t("Manage your farm fields, soil types, irrigation, and track crop cycles per field.")}
        tone="light"
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('Total Fields'), value: fields.length, color: 'from-emerald-500 to-lime-400' },
          { label: t('Active Fields'), value: fields.filter(f => f.status?.toLowerCase() === 'active').length, color: 'from-green-600 to-emerald-400' },
          { label: t('With Crops'), value: fields.filter(f => f.crop_name).length, color: 'from-teal-500 to-emerald-300' },
          { label: t('Total Area'), value: `${fields.reduce((a, f) => a + (Number(f.area) || 0), 0)} ${t('Acres')}`, color: 'from-lime-500 to-green-300' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-900/80 border border-white/10 rounded-2xl p-4">
            <div className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</div>
            <div className="text-slate-400 text-sm mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Fields Grid */}
      <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-white font-semibold text-lg">{t("Farm Fields")}</h2>
          <Button onClick={openAdd} className="flex items-center gap-2">
            <FiPlus /> {t("Add Field")}
          </Button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-4">{error}</div>}

        {isLoading ? (
          <div className="text-center py-16 text-slate-500">{t("Loading fields...")}</div>
        ) : fields.length === 0 ? (
          <div className="text-center py-16">
            <FiMapPin className="text-4xl text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg font-medium">{t("No fields yet")}</p>
            <p className="text-slate-500 text-sm mt-1">{t("Click **Add Field** to create your first farm field.")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {fields.map(field => (
              <div key={field.id} className="bg-slate-950/60 border border-white/10 rounded-2xl p-5 hover:border-emerald-500/30 transition-all group">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-white font-bold text-lg">{field.field_name}</h3>
                    {field.field_code && <p className="text-slate-500 text-xs mt-0.5">#{field.field_code}</p>}
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${statusColor(field.status)}`}>
                    {field.status || 'Active'}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <FiActivity className="text-emerald-400 shrink-0" />
                    <span><span className="text-slate-300">{field.area || 'N/A'}</span> {t("Acres")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <FiLayers className="text-blue-400 shrink-0" />
                    <span>{field.soil_type || 'No soil type set'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <FiDroplet className="text-cyan-400 shrink-0" />
                    <span>{field.irrigation_type || 'No irrigation set'}</span>
                  </div>
                  {field.location && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <FiMapPin className="text-amber-400 shrink-0" />
                      <span>{field.location}</span>
                    </div>
                  )}
                </div>

                {/* Crop Badge */}
                <div className="border-t border-white/5 pt-3 mb-4">
                  {field.crop_name ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{t("Current Crop:")}</span>
                      <span className="font-semibold text-white text-sm">{field.crop_name}</span>
                      {field.growth_stage && <span className={`text-xs ${cropStatusColor(field.crop_status || '')}`}> · {field.growth_stage}</span>}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-600 italic">{t("No active crop cycle")}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/dashboard/farm-manager/fields/${field.id}`)}
                    className="flex-1 text-center text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-2 rounded-xl hover:bg-emerald-500/20 transition-colors"
                  >
                    {t("View Details")}
                  </button>
                  <button
                    onClick={() => openEdit(field)}
                    className="p-2 bg-slate-800 text-slate-400 border border-white/10 rounded-xl hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    onClick={() => handleDelete(field.id, field.field_name)}
                    className="p-2 bg-slate-800 text-slate-400 border border-white/10 rounded-xl hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-bold text-white mb-6">{editField ? 'Edit Field' : 'Add New Field'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Field Name *</label>
                  <input required type="text" value={formData.field_name}
                    onChange={e => setFormData({ ...formData, field_name: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. North Field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Field Code</label>
                  <input type="text" value={formData.field_code}
                    onChange={e => setFormData({ ...formData, field_code: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. F-001" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Area (Acres)</label>
                  <input type="number" step="0.01" min="0" value={formData.area}
                    onChange={e => setFormData({ ...formData, area: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. 2.5" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Fallow">Fallow</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Soil Type</label>
                  <select value={formData.soil_type} onChange={e => setFormData({ ...formData, soil_type: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none">
                    <option value="">Select soil type</option>
                    {SOIL_TYPES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Irrigation Type</label>
                  <select value={formData.irrigation_type} onChange={e => setFormData({ ...formData, irrigation_type: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none">
                    <option value="">Select irrigation</option>
                    {IRRIGATION_TYPES.map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Location / Notes</label>
                <input type="text" value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="e.g. North-east sector near river" />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editField ? 'Update Field' : 'Add Field'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
