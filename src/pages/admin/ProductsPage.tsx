import { useState, useEffect } from 'react';
import { Plus, Trash2, PackagePlus, Eye, TrendingUp, Package, IndianRupee } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function ProductsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState<any>(null);
  
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Details Modal State
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDetails, setProductDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Stock form state
  const [addQuantity, setAddQuantity] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const [productsRes, inventoryRes, salesRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('seller_inventory').select('product_id, available_quantity'),
      supabase.from('sales').select('product_id, quantity')
    ]);

    let prodData = productsRes.data || [];
    let invData = inventoryRes.data || [];
    let salesData = salesRes.data || [];

    const sellerStockMap: Record<string, number> = {};
    invData.forEach((inv: any) => {
      if (!sellerStockMap[inv.product_id]) sellerStockMap[inv.product_id] = 0;
      sellerStockMap[inv.product_id] += inv.available_quantity;
    });

    const soldMap: Record<string, number> = {};
    salesData.forEach((s: any) => {
      if (!soldMap[s.product_id]) soldMap[s.product_id] = 0;
      soldMap[s.product_id] += s.quantity;
    });

    const productsWithTotal = prodData.map((p: any) => ({
      ...p,
      stock_with_sellers: sellerStockMap[p.id] || 0,
      total_sold: soldMap[p.id] || 0,
      total_units: (p.stock_quantity || 0) + (sellerStockMap[p.id] || 0)
    }));

    setProducts(productsWithTotal);
    setLoading(false);
  };

  const handleAddProduct = async () => {
    setIsSubmitting(true);
    const { error } = await supabase.from('products').insert([
      {
        name,
        category,
        cost_price: parseFloat(costPrice),
        selling_price: parseFloat(sellingPrice),
        stock_quantity: 0 
      }
    ]);

    setIsSubmitting(false);
    if (!error) {
      setShowAddModal(false);
      setName('');
      setCategory('');
      setCostPrice('');
      setSellingPrice('');
      fetchProducts();
    } else {
      alert("Error adding product: " + error.message);
    }
  };

  const handleAddStock = async () => {
    if (!showStockModal || !addQuantity || parseInt(addQuantity) <= 0) return;
    setIsSubmitting(true);
    
    const newStock = (showStockModal.stock_quantity || 0) + parseInt(addQuantity);
    
    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', showStockModal.id);
      
    setIsSubmitting(false);
    
    if (!error) {
      setShowStockModal(null);
      setAddQuantity('');
      fetchProducts();
    } else {
      alert("Error updating stock: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this product? All stock and history related to it may be affected.")) {
      await supabase.from('products').delete().eq('id', id);
      fetchProducts();
    }
  };

  const openProductDetails = async (product: any) => {
    setSelectedProduct(product);
    setLoadingDetails(true);

    const [invRes, salesRes, sellersRes] = await Promise.all([
      supabase.from('seller_inventory').select('available_quantity, seller_id').eq('product_id', product.id),
      supabase.from('sales').select('quantity, revenue, profit').eq('product_id', product.id),
      supabase.from('sellers').select('id, name')
    ]);

    const sellerMap: any = {};
    if (sellersRes.data) {
      sellersRes.data.forEach(s => {
        sellerMap[s.id] = s.name;
      });
    }

    let stockWithSellers = 0;
    let sellersHolding: any[] = [];
    
    if (invRes.data) {
      invRes.data.forEach((item: any) => {
        stockWithSellers += item.available_quantity;
        if (item.available_quantity > 0) {
          sellersHolding.push({ name: sellerMap[item.seller_id] || 'Unknown', qty: item.available_quantity });
        }
      });
    }

    let totalSold = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    
    if (salesRes.data) {
      salesRes.data.forEach((s: any) => {
        totalSold += s.quantity;
        totalRevenue += s.revenue;
        totalProfit += s.profit;
      });
    }

    setProductDetails({ stockWithSellers, sellersHolding, totalSold, totalRevenue, totalProfit });
    setLoadingDetails(false);
  };

  return (
    <div className="space-y-10 w-full p-6 md:p-8 pb-10 max-w-7xl mx-auto">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter uppercase mb-2">Main Warehouse</h1>
          <div className="inline-block bg-black text-white px-3 py-1 font-bold uppercase text-sm tracking-widest">
            Inventory
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="brutal-btn bg-black text-white px-5 py-3 flex items-center gap-3 text-[14px]"
        >
          <Plus size={20} strokeWidth={3} />
          CREATE NEW PRODUCT
        </button>
      </div>

      <div className="brutal-box bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[12px] text-white font-black uppercase bg-black">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Cost</th>
                <th className="px-6 py-4 text-right">Selling</th>
                <th className="px-6 py-4 text-center border-x border-white/20 bg-[#3b82f6] text-white">Active Units</th>
                <th className="px-6 py-4 text-center">Warehouse</th>
                <th className="px-6 py-4 text-center">Sellers</th>
                <th className="px-6 py-4 text-center border-x-4 border-black bg-[#4ade80] text-black">Total Sold</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-4 divide-black">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-[14px] font-black uppercase text-black">Loading products...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-[14px] font-black uppercase text-black">No products found. Add a new product first!</td></tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-[#fde047] transition-colors bg-white">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-black text-white flex items-center justify-center">
                          <Package size={24} strokeWidth={2} />
                        </div>
                        <div>
                          <p className="font-black text-[16px] text-black uppercase tracking-tighter cursor-pointer hover:underline" onClick={() => openProductDetails(p)}>{p.name}</p>
                          <p className="text-[12px] text-black font-bold uppercase cursor-pointer hover:underline" onClick={() => openProductDetails(p)}>View Details</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[14px] text-black font-black uppercase">{p.category}</td>
                    <td className="px-6 py-4 text-right font-black text-black text-[16px]">₹{p.cost_price}</td>
                    <td className="px-6 py-4 text-right font-black text-black text-[16px]">₹{p.selling_price}</td>
                    <td className="px-6 py-4 text-center border-x-4 border-black bg-[#e5e5e5]">
                      <span className="font-black text-[18px] bg-black text-white px-3 py-1">{p.total_units}</span>
                    </td>
                    <td className="px-6 py-4 text-center font-black text-[16px]">
                      {p.stock_quantity || 0}
                    </td>
                    <td className="px-6 py-4 text-center font-black text-[16px] text-[#3b82f6]">
                      {p.stock_with_sellers || 0}
                    </td>
                    <td className="px-6 py-4 text-center border-x-4 border-black bg-[#f0fdf4]">
                      <span className="font-black text-[18px] text-[#22c55e]">{p.total_sold}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button 
                          onClick={() => setShowStockModal(p)} 
                          className="brutal-btn bg-[#4ade80] text-black px-4 py-2 font-black text-[12px] flex items-center gap-2"
                        >
                          <PackagePlus size={16} strokeWidth={3} />
                          ADD STOCK
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="w-10 h-10 brutal-btn bg-[#f472b6] flex items-center justify-center text-black" title="Delete Product">
                          <Trash2 size={16} strokeWidth={3} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRODUCT DETAILS MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm">
          <div className="brutal-box bg-white w-full max-w-4xl max-h-[90vh] flex flex-col relative z-10 overflow-hidden">
            
            <div className="p-6 sm:p-8 flex justify-between items-start bg-[#fde047] border-b-4 border-black">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-black flex items-center justify-center text-white brutal-box border-none shadow-none">
                  <Package size={32} strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-black mb-2 tracking-tighter uppercase">{selectedProduct.name}</h2>
                  <p className="text-[14px] text-black font-bold uppercase bg-white border-2 border-black inline-block px-3 py-1">{selectedProduct.category} &bull; Cost: ₹{selectedProduct.cost_price} &bull; Selling: ₹{selectedProduct.selling_price}</p>
                </div>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="w-12 h-12 flex items-center justify-center brutal-btn bg-white">
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"/>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-[#e5e5e5]">
              {loadingDetails ? (
                <div className="py-10 text-center text-[16px] font-black uppercase text-black">Fetching performance data...</div>
              ) : (
                <div className="space-y-8">
                  
                  {/* Lifecycle Overview */}
                  <div>
                    <h3 className="text-[18px] font-black text-black tracking-tighter uppercase mb-4 flex items-center gap-3 border-b-4 border-black pb-2">
                      <Package size={24} strokeWidth={3} className="text-black" /> Product Lifecycle
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      
                      <div className="brutal-box bg-[#e5e5e5] p-4 flex flex-col justify-between border-dashed">
                        <p className="text-[12px] font-black text-black mb-2 uppercase border-b-2 border-black pb-1">Total Added (Ever)</p>
                        <p className="text-3xl font-black text-black tracking-tighter">
                          {(selectedProduct.stock_quantity || 0) + (productDetails?.stockWithSellers || 0) + (productDetails?.totalSold || 0)}
                        </p>
                      </div>

                      <div className="brutal-box bg-black p-4 flex flex-col justify-between">
                        <p className="text-[12px] font-black text-white mb-2 uppercase border-b-2 border-white/30 pb-1">Total Sold (Ever)</p>
                        <p className="text-3xl font-black text-white tracking-tighter">{productDetails?.totalSold || 0}</p>
                      </div>

                      <div className="brutal-box bg-[#fde047] p-4 flex flex-col justify-between">
                        <p className="text-[12px] font-black text-black mb-2 uppercase border-b-2 border-black pb-1">Current With Sellers</p>
                        <p className="text-3xl font-black text-black tracking-tighter">{productDetails?.stockWithSellers || 0}</p>
                      </div>
                      
                      <div className="brutal-box bg-white p-4 flex flex-col justify-between">
                        <p className="text-[12px] font-black text-black mb-2 uppercase border-b-2 border-black pb-1">Current Warehouse</p>
                        <p className="text-3xl font-black text-black tracking-tighter">{selectedProduct.stock_quantity || 0}</p>
                      </div>

                    </div>
                  </div>

                  {/* Performance */}
                  <div>
                    <h3 className="text-[18px] font-black text-black tracking-tighter uppercase mb-4 flex items-center gap-3 border-b-4 border-black pb-2">
                      <TrendingUp size={24} strokeWidth={3} className="text-black" /> All-Time Performance
                    </h3>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="brutal-box bg-white p-6">
                        <p className="text-[12px] font-black text-black uppercase mb-2">Total Sold</p>
                        <p className="text-2xl font-black text-black tracking-tighter">{productDetails?.totalSold || 0} UNITS</p>
                      </div>
                      <div className="brutal-box bg-[#3b82f6] p-6">
                        <p className="text-[12px] font-black text-black uppercase mb-2">Total Revenue</p>
                        <p className="text-2xl font-black text-black tracking-tighter">₹{productDetails?.totalRevenue.toFixed(2) || '0.00'}</p>
                      </div>
                      <div className="brutal-box bg-[#4ade80] p-6">
                        <p className="text-[12px] font-black text-black uppercase mb-2">Total Profit</p>
                        <p className="text-2xl font-black text-black tracking-tighter">₹{productDetails?.totalProfit.toFixed(2) || '0.00'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sellers Holding Stock */}
                  <div>
                    <h3 className="text-[18px] font-black text-black tracking-tighter uppercase mb-4 flex items-center gap-3 border-b-4 border-black pb-2">
                      <Package size={24} strokeWidth={3} className="text-black" /> Sellers Holding This Item
                    </h3>
                    <div className="brutal-box bg-white overflow-hidden">
                      <div className="divide-y-4 divide-black">
                        {productDetails?.sellersHolding.length === 0 ? (
                          <div className="p-6 text-[14px] text-black font-black uppercase text-center">No sellers currently hold this item.</div>
                        ) : (
                          productDetails?.sellersHolding.map((sh: any, i: number) => (
                            <div key={i} className="flex justify-between items-center p-5 bg-white">
                              <span className="font-black text-[16px] uppercase text-black">{sh.name}</span>
                              <span className="bg-black text-white px-4 py-2 text-[14px] font-black uppercase">{sh.qty} units</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="brutal-box bg-white w-full max-w-md flex flex-col">
            <div className="p-6 bg-[#3b82f6] border-b-4 border-black flex justify-between items-center">
              <h2 className="font-black text-2xl uppercase tracking-tighter text-black">Create Product</h2>
              <button onClick={() => setShowAddModal(false)} className="w-10 h-10 brutal-btn bg-white flex items-center justify-center">
                 <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"/>
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-5 bg-white">
              <div className="brutal-box bg-[#fde047] p-4 text-xs font-bold uppercase">
                <strong>NOTE:</strong> Use this only for new items. To restock, use Add Stock in inventory.
              </div>
              <div>
                <label className="block text-sm font-black uppercase mb-2">Product Name</label>
                <input value={name} onChange={e=>setName(e.target.value)} type="text" className="w-full px-4 py-3 brutal-input text-sm" placeholder="e.g. Lays Classic" />
              </div>
              <div>
                <label className="block text-sm font-black uppercase mb-2">Category</label>
                <input value={category} onChange={e=>setCategory(e.target.value)} type="text" className="w-full px-4 py-3 brutal-input text-sm" placeholder="e.g. Snacks" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-black uppercase mb-2">Cost Price</label>
                  <input value={costPrice} onChange={e=>setCostPrice(e.target.value)} type="number" className="w-full px-4 py-3 brutal-input text-sm" placeholder="₹" />
                </div>
                <div>
                  <label className="block text-sm font-black uppercase mb-2">Selling Price</label>
                  <input value={sellingPrice} onChange={e=>setSellingPrice(e.target.value)} type="number" className="w-full px-4 py-3 brutal-input text-sm" placeholder="₹" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t-4 border-black bg-white flex justify-end gap-4">
              <button onClick={() => setShowAddModal(false)} className="px-6 py-3 text-sm brutal-btn bg-white">CANCEL</button>
              <button onClick={handleAddProduct} disabled={isSubmitting} className="px-6 py-3 bg-black text-white text-sm brutal-btn hover:bg-[#3b82f6] hover:text-black">
                {isSubmitting ? 'SAVING...' : 'CREATE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="brutal-box bg-white w-full max-w-sm flex flex-col">
            <div className="p-6 bg-[#4ade80] border-b-4 border-black flex justify-between items-center">
              <h2 className="font-black text-2xl uppercase tracking-tighter text-black">Add Stock</h2>
              <button onClick={() => setShowStockModal(null)} className="w-10 h-10 brutal-btn bg-white flex items-center justify-center">
                 <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"/>
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-5 bg-white">
              <div>
                <p className="text-[14px] text-black mb-6 font-bold uppercase leading-relaxed">
                  Add inventory for <span className="bg-black text-white px-2 py-1 mx-1">{showStockModal.name}</span>.<br/><br/>
                  Current stock: <span className="font-black text-xl">{showStockModal.stock_quantity || 0}</span>.
                </p>
                <label className="block text-sm font-black uppercase mb-2">Quantity to add</label>
                <input 
                  value={addQuantity} 
                  onChange={e=>setAddQuantity(e.target.value)} 
                  type="number" 
                  min="1"
                  className="w-full px-4 py-4 brutal-input text-[24px] font-black text-center"
                  placeholder="0" 
                />
              </div>
            </div>
            <div className="p-6 border-t-4 border-black bg-white flex justify-end gap-4">
              <button onClick={() => setShowStockModal(null)} className="px-6 py-3 text-sm brutal-btn bg-white">CANCEL</button>
              <button onClick={handleAddStock} disabled={isSubmitting || !addQuantity} className="px-6 py-3 bg-black text-white text-sm brutal-btn hover:bg-[#4ade80] hover:text-black">
                {isSubmitting ? 'ADDING...' : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
