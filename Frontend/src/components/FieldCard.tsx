import React from 'react';
import { useNavigate } from 'react-router-dom';

interface FieldCardProps {
  field: {
    id: string;
    field_name: string;
    area: number;
    soil_type: string;
    irrigation_type: string;
    status: string;
    crop_name?: string;
    growth_stage?: string;
    crop_status?: string;
    soil_ph?: string | number | null;
    soil_fertility_level?: string | null;
    drainage_quality?: string | null;
  };
}

export function FieldCard({ field }: FieldCardProps) {
  const navigate = useNavigate();

  const getPhClassification = (ph: string | number | null | undefined) => {
    if (ph === null || ph === undefined || ph === '') return null;
    const numPh = typeof ph === 'string' ? parseFloat(ph) : ph;
    if (isNaN(numPh)) return null;

    if (numPh < 5.5) return { label: 'Strongly Acidic', color: 'bg-red-100 text-red-800', icon: '🔴' };
    if (numPh >= 5.5 && numPh < 6.5) return { label: 'Slightly Acidic', color: 'bg-yellow-100 text-yellow-800', icon: '🟡' };
    if (numPh >= 6.5 && numPh < 7.5) return { label: 'Neutral (Recommended)', color: 'bg-green-100 text-green-800', icon: '🟢' };
    if (numPh >= 7.5 && numPh < 8.5) return { label: 'Slightly Alkaline', color: 'bg-orange-100 text-orange-800', icon: '🟠' };
    return { label: 'Strongly Alkaline', color: 'bg-red-100 text-red-800', icon: '🔴' };
  };

  const phInfo = getPhClassification(field.soil_ph);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-semibold text-gray-800">{field.field_name}</h3>
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${field.status.toLowerCase() === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
          {field.status}
        </span>
      </div>
      
      <div className="space-y-2 text-sm text-gray-600 mb-6">
        <p><span className="font-medium text-gray-700">Area:</span> {field.area} Acres</p>
        <p><span className="font-medium text-gray-700">Soil:</span> {field.soil_type || 'N/A'}</p>
        
        {field.soil_ph && (
          <div className="flex items-center space-x-2">
            <p><span className="font-medium text-gray-700">pH:</span> {field.soil_ph}</p>
            {phInfo && (
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full flex items-center space-x-1 ${phInfo.color}`}>
                <span>{phInfo.icon}</span>
                <span>{phInfo.label}</span>
              </span>
            )}
          </div>
        )}

        {field.soil_fertility_level && (
          <p><span className="font-medium text-gray-700">Fertility:</span> {field.soil_fertility_level}</p>
        )}
        
        {field.drainage_quality && (
          <p><span className="font-medium text-gray-700">Drainage:</span> {field.drainage_quality}</p>
        )}

        <p><span className="font-medium text-gray-700">Irrigation:</span> {field.irrigation_type || 'N/A'}</p>
        
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p><span className="font-medium text-gray-700">Current Crop:</span> {field.crop_name || 'None'}</p>
          <p><span className="font-medium text-gray-700">Growth Stage:</span> {field.growth_stage || 'N/A'}</p>
        </div>
      </div>
      
      <button 
        onClick={() => navigate(`/dashboard/farm-manager/fields/${field.id}`)}
        className="w-full bg-indigo-50 text-indigo-600 font-medium py-2 px-4 rounded hover:bg-indigo-100 transition-colors"
      >
        View Details
      </button>
    </div>
  );
}
