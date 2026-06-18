import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getMarketplaceProducts, addToCart } from '../../api/marketplace';

export default function CustomerMarketplacePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<{[key: string]: number}>({});

  const handleQuantityChange = (id: string, value: string) => {
    setQuantities(prev => ({...prev, [id]: Number(value) || 1}));
  };

  useEffect(() => {
    fetchProducts();
  }, [category]); // Fetch when category changes

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getMarketplaceProducts({ category, search });
      setProducts(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const handleAddToCart = async (product_id: string) => {
    try {
      const quantity = quantities[product_id] || 1;
      await addToCart({ product_id, quantity });
      alert('Product added to cart!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add to cart.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
        <h1 className="text-2xl font-bold text-gray-900">Farm Marketplace</h1>
        <div className="flex space-x-4 w-full md:w-auto">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 text-slate-900 bg-white">
            <option value="">All Categories</option>
            <option value="Vegetable">Vegetables</option>
            <option value="Fruit">Fruits</option>
            <option value="Dairy">Dairy</option>
            <option value="Meat">Meat</option>
          </select>
          <form onSubmit={handleSearch} className="flex flex-1 md:w-64">
            <input 
              type="text" 
              placeholder="Search products..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-l-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 flex-1 text-slate-900 bg-white placeholder-gray-500"
            />
            <Button type="submit" className="rounded-l-none inline-flex items-center justify-center px-5 py-3 text-sm font-semibold tracking-wide transition duration-300 border border-emerald-500/20 bg-emerald-600 text-white shadow-[0_12px_30px_rgba(16,185,129,0.22)] hover:bg-emerald-700">Search</Button>
          </form>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading products...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : products.length === 0 ? (
        <p className="text-gray-500">No products found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((p) => (
            <Card key={p.id} className="flex flex-col h-full overflow-hidden">
              <div className="relative h-48 overflow-hidden rounded-t-2xl bg-gray-100">
                {p.image_url ? (
                  <img src={p.image_url ? (p.image_url.startsWith('http') ? p.image_url : `http://localhost:5000${p.image_url}`) : ''} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 hover:scale-105 cursor-pointer" onClick={() => setPreviewImg(p.image_url ? (p.image_url.startsWith('http') ? p.image_url : `http://localhost:5000${p.image_url}`) : '') } />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                )}
                <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded text-xs font-bold text-green-700 shadow">
                  Grade {p.quality_grade}
                </div>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold text-gray-900">{p.name}</h3>
                  <span className="text-lg font-bold text-green-600">Rs. {p.price}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{p.farm_name}</p>
                <p className="text-xs text-gray-500 mt-2 mb-4 flex-1 line-clamp-2">{p.description}</p>
                <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-100">
                  <span className="text-sm text-gray-600 font-medium">{p.available_quantity} {p.unit} available</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="1" 
                      max={p.available_quantity} 
                      value={quantities[p.id] || 1} 
                      onChange={(e) => handleQuantityChange(p.id, e.target.value)} 
                      className="w-16 h-10 px-2 text-sm rounded-md border border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 text-slate-900 bg-white"
                    />
                    <Button onClick={() => handleAddToCart(p.id)} theme="light">Add</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {previewImg && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} alt="Preview" className="max-w-full max-h-full rounded-lg shadow-lg" />
        </div>
      )}
    </div>
  );
}
