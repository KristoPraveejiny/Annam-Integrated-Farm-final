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
  };
}

export function FieldCard({ field }: FieldCardProps) {
  const navigate = useNavigate();

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
