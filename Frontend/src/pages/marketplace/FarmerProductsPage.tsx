import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getFarmerProducts, addProduct } from '../../api/marketplace';

export default function FarmerProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    product_name: '',
    category: 'Vegetable',
    quantity: '',
    unit: 'kg',
    harvest_date: '',
    description: '',
    quality_grade: 'A'
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getFarmerProducts();
      setProducts(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      Object.keys(formData).forEach(key => {
        formDataToSend.append(key, (formData as any)[key]);
      });
      if (imageFile) {
        formDataToSend.append('image', imageFile);
      }

      await addProduct(formDataToSend);
      setIsAdding(false);
      setImageFile(null);
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add product.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">My Products</h1>
        <Button onClick={() => setIsAdding(!isAdding)}>{isAdding ? 'Cancel' : 'Add Product'}</Button>
      </div>

      {isAdding && (
        <Card title="Add New Product">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/90">Product Name</label>
                <input required type="text" name="product_name" value={formData.product_name} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 text-slate-900 shadow-sm focus:border-green-500 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90">Category</label>
                <select name="category" value={formData.category} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 text-slate-900 shadow-sm focus:border-green-500 focus:ring-green-500">
                  <option value="Vegetable">Vegetable</option>
                  <option value="Fruit">Fruit</option>
                  <option value="Dairy">Dairy</option>
                  <option value="Grain">Grain</option>
                  <option value="Meat">Meat</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90">Quantity</label>
                <input required type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 text-slate-900 shadow-sm focus:border-green-500 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90">Unit</label>
                <select name="unit" value={formData.unit} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 text-slate-900 shadow-sm focus:border-green-500 focus:ring-green-500">
                  <option value="kg">kg</option>
                  <option value="liter">liter</option>
                  <option value="piece">piece</option>
                  <option value="bunch">bunch</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90">Harvest Date</label>
                <input type="date" name="harvest_date" value={formData.harvest_date} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 text-slate-900 shadow-sm focus:border-green-500 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90">Quality Grade</label>
                <select name="quality_grade" value={formData.quality_grade} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 text-slate-900 shadow-sm focus:border-green-500 focus:ring-green-500">
                  <option value="A">A - Premium</option>
                  <option value="B">B - Standard</option>
                  <option value="C">C - Processing</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white/90">Product Image</label>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-white/90 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white/90">Description</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} className="mt-1 block w-full rounded-md border-gray-300 text-slate-900 shadow-sm focus:border-green-500 focus:ring-green-500"></textarea>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit">Submit Product</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="p-4 text-gray-500">Loading products...</p>
        ) : error ? (
          <p className="p-4 text-red-500">{error}</p>
        ) : products.length === 0 ? (
          <p className="p-4 text-gray-500">You haven't added any products yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {p.image_url && <img src={p.image_url.startsWith('http') ? p.image_url : `http://localhost:5000${p.image_url}`} alt="" className="w-10 h-10 rounded-full mr-3 object-cover" />}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{p.name}</div>
                          <div className="text-xs text-gray-500">Code: {p.product_code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.available_quantity} {p.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.price > 0 ? `Rs. ${p.price}` : 'Pending'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                        p.status === 'approved' ? 'bg-green-100 text-green-800' :
                        p.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        p.status === 'out_of_stock' ? 'bg-gray-100 text-gray-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{p.approval_remarks || '-'}</td>
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
