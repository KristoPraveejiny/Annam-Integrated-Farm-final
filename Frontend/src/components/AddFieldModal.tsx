import React, { useState } from 'react';

interface AddFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (fieldData: any) => Promise<void>;
}

export function AddFieldModal({ isOpen, onClose, onAdd }: AddFieldModalProps) {
  const [formData, setFormData] = useState({
    field_name: '',
    area: '',
    soil_type: '',
    irrigation_type: '',
    location: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onAdd({
        ...formData,
        area: parseFloat(formData.area),
      });
      setFormData({
        field_name: '',
        area: '',
        soil_type: '',
        irrigation_type: '',
        location: '',
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Add New Field</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            &times;
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Field Name *</label>
            <input 
              required
              type="text" 
              name="field_name"
              value={formData.field_name}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2" 
              placeholder="e.g. North Field"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Area (Acres)</label>
            <input 
              type="number" 
              step="0.01"
              name="area"
              value={formData.area}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2" 
              placeholder="e.g. 2.5"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Soil Type</label>
            <input 
              type="text" 
              name="soil_type"
              value={formData.soil_type}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2" 
              placeholder="e.g. Loamy Soil"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Irrigation Type</label>
            <select 
              name="irrigation_type"
              value={formData.irrigation_type}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="">Select Irrigation</option>
              <option value="Drip Irrigation">Drip Irrigation</option>
              <option value="Sprinkler">Sprinkler</option>
              <option value="Surface">Surface</option>
              <option value="None">None</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location / Coordinates</label>
            <input 
              type="text" 
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2" 
              placeholder="e.g. North sector"
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Field'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
