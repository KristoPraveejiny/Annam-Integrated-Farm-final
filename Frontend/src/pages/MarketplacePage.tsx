import { useEffect, useState } from 'react';
import { FiFilter, FiGrid, FiSearch, FiStar } from 'react-icons/fi';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { getMarketplaceProducts, addToCart } from '../api/marketplace';
import { useNavigate } from 'react-router-dom';

import { PublicHeader } from '../components/layout/PublicHeader';

export default function MarketplacePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [quantities, setQuantities] = useState<{[key: string]: number}>({});
  const navigate = useNavigate();

  const handleQuantityChange = (id: string, value: string) => {
    setQuantities(prev => ({...prev, [id]: Number(value) || 1}));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getMarketplaceProducts();
      setProducts(data);
      if (data.length > 0) {
        setSelectedProduct(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const data = await getMarketplaceProducts({ search });
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (product: any) => {
    try {
      const quantity = quantities[product.id] || 1;
      await addToCart({ product_id: product.id, quantity });
      alert('Product added to cart!');
    } catch (err: any) {
      if (err.response?.status === 401) {
        alert('Please login to add to cart.');
        navigate('/login');
      } else {
        alert(err.response?.data?.error || 'Failed to add to cart.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PublicHeader active="marketplace" />
      <div className="section-shell py-10">
      <SectionHeading eyebrow="Marketplace" title="Fresh produce marketplace" description="Search products, filter by category, review ratings, and purchase farm-fresh goods with a polished ecommerce experience." tone="light" />

      <form onSubmit={handleSearch} className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            className="farm-input pl-11 w-full text-slate-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500" 
            placeholder="Search vegetables, fruits, milk, eggs, organic items..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"><FiSearch /> Search</button>
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"><FiGrid /> QR Section</button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="col-span-full py-10 text-center text-white/70">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="col-span-full py-10 text-center text-white/70">No products found.</div>
          ) : (
            products.map((product) => (!showPreview || selectedProduct?.id === product.id) && (
            <div className="farm-card p-5 sm:p-6 border border-solid rounded-2xl border-white/15 bg-white/90 text-slate-900 shadow-[0_18px_55px_rgba(2,6,23,0.25)] flex flex-col h-full overflow-hidden aspect-square">
              <Card 
                key={product.id} 
                title={product.name} 
                subtitle={`${product.category} | Farm: ${product.farm_name}`}
              >
                {/* Image clickable to open preview */}
                <div 
                  className="h-40 rounded-2xl bg-gradient-to-br from-emerald-100 via-lime-50 to-white overflow-hidden cursor-pointer"
                  onClick={() => { setSelectedProduct(product); setShowPreview(true); }}
                >
                  {product.image_url ? (
                    <img 
                      src={product.image_url.startsWith('http') ? product.image_url : `http://localhost:5000${product.image_url}`} 
                      alt={product.name} 
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">No Image</div>
                  )}
                </div>
                {/* Only show Preview button; detailed info is in preview modal */}
                <div className="mt-4 flex justify-center">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); setShowPreview(true); }} 
                    className="rounded-2xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                  >
                    Preview
                  </button>
                </div>
              </Card>
            </div>
          )))}
        </div>

        <div className="space-y-6">
          {showPreview && selectedProduct && (
            <Card title="Product Details Modal" subtitle="Preview selected product details" className="aspect-square">
              <div className="rounded-3xl border border-slate-100 p-4">
                {selectedProduct.image_url && (
                   <img 
                      src={selectedProduct.image_url.startsWith('http') ? selectedProduct.image_url : `http://localhost:5000${selectedProduct.image_url}`} 
                      alt={selectedProduct.name} 
                      className="h-32 w-full object-cover rounded-2xl mb-4" 
                    />
                )}
                <p className="text-lg font-black text-slate-900">{selectedProduct.name}</p>
                <p className="mt-2 text-sm text-slate-600">{selectedProduct.description || 'No description available for this product.'}</p>
                <div className="mt-4 flex flex-col gap-1 text-sm text-slate-500">
                   <p><strong>Farm:</strong> {selectedProduct.farm_name}</p>
                   <p><strong>Category:</strong> {selectedProduct.category}</p>
                   <p><strong>Available:</strong> {selectedProduct.available_quantity} {selectedProduct.unit}</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                    <input 
                      type="number" 
                      min="1" 
                      max={selectedProduct.available_quantity} 
                      value={quantities[selectedProduct.id] || 1} 
                      onChange={(e) => handleQuantityChange(selectedProduct.id, e.target.value)} 
                      className="w-20 h-11 px-3 text-sm rounded-2xl border border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-slate-800"
                    />
                    <button onClick={() => handleAddToCart(selectedProduct)} className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">Add to cart</button>
                </div>
                <button onClick={() => setShowPreview(false)} className="mt-4 w-full text-sm text-slate-400 hover:text-slate-600">Close Preview</button>
              </div>
            </Card>
          )}
          <Card title="QR Code Section" subtitle="Batch traceability">
            <div className="grid place-items-center rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50 p-10">
              <FiGrid className="text-6xl text-emerald-600" />
              <p className="mt-3 text-center text-sm text-slate-600">Verify produce origin, batch, and storage conditions.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
    </div>
  );
}