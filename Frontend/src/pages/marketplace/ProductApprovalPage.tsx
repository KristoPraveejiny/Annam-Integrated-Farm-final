import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getPendingProducts, approveProduct, rejectProduct } from '../../api/marketplace';

export default function ProductApprovalPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [approvedPrice, setApprovedPrice] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getPendingProducts();
      setProducts(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load pending products.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !actionType) return;
    
    try {
      if (actionType === 'approve') {
        if (!approvedPrice) return alert('Please enter an approved price.');
        await approveProduct(selectedProduct.id, { approved_price: approvedPrice, remarks });
      } else {
        if (!remarks) return alert('Please enter remarks for rejection.');
        await rejectProduct(selectedProduct.id, { remarks });
      }
      
      setSelectedProduct(null);
      setActionType(null);
      setRemarks('');
      setApprovedPrice('');
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to process product.');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Product Approvals</h1>

      {selectedProduct && actionType && (
        <Card title={`${actionType === 'approve' ? 'Approve' : 'Reject'} Product: ${selectedProduct.name}`}>
          <form onSubmit={handleAction} className="space-y-4">
            {actionType === 'approve' && (
              <div>
                <label className="block text-sm font-semibold text-white/90">Selling Price (Rs per {selectedProduct?.unit || 'unit'})</label>
                <input required type="number" step="0.01" value={approvedPrice} onChange={(e) => setApprovedPrice(e.target.value)} className="farm-input w-full mt-1" />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-white/90">Remarks {actionType === 'reject' ? '(Required)' : '(Optional)'}</label>
              <textarea required={actionType === 'reject'} value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} className="farm-input w-full mt-1"></textarea>
            </div>
            <div className="flex justify-end space-x-3">
              <Button onClick={() => { setSelectedProduct(null); setActionType(null); }}>Cancel</Button>
              <Button type="submit">
                Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="p-4 text-gray-500">Loading pending products...</p>
        ) : error ? (
          <p className="p-4 text-red-500">{error}</p>
        ) : products.length === 0 ? (
          <p className="p-4 text-gray-500">No pending products to review.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Farmer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Harvest Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {p.image_url && <img src={p.image_url} alt="" className="w-10 h-10 rounded-full mr-3 object-cover" />}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{p.name}</div>
                          <div className="text-xs text-gray-500">{p.category} | Grade: {p.quality_grade}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.farmer_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.available_quantity} {p.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.harvest_date ? new Date(p.harvest_date).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => { setSelectedProduct(p); setActionType('approve'); }} className="text-green-600 hover:text-green-900">Approve</button>
                      <button onClick={() => { setSelectedProduct(p); setActionType('reject'); }} className="text-red-600 hover:text-red-900">Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
