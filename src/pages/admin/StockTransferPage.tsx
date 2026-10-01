import { useState, useEffect } from 'react';
import { ShoppingBasket, Trash2, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function StockTransferPage() {
  const [sellers, setSellers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Basket state
  const [basket, setBasket] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [sellersRes, productsRes, transfersRes] = await Promise.all([
      supabase.from('sellers').select('*'),
      supabase.from('products').select('*').eq('is_active', true),
      supabase.from('stock_transfers')
        .select(`
          id, quantity, created_at,
          sellers ( name ),
          products ( name )
        `)
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    if (sellersRes.data) setSellers(sellersRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    if (transfersRes.data) setTransfers(transfersRes.data);
  };

  const handleAddToBasket = () => {
    if (!selectedProduct || !quantity || parseInt(quantity) <= 0) return;
    
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const existingIndex = basket.findIndex(item => item.product_id === selectedProduct);
    const currentQtyInBasket = existingIndex >= 0 ? basket[existingIndex].quantity : 0;
    
    if (currentQtyInBasket + parseInt(quantity) > (product.stock_quantity || 0)) {
      return alert(`Not enough warehouse stock! Only ${product.stock_quantity || 0} available.`);
    }
    
    if (existingIndex >= 0) {
      const newBasket = [...basket];
      newBasket[existingIndex].quantity += parseInt(quantity);
      setBasket(newBasket);
    } else {
      setBasket([...basket, {
        product_id: product.id,
        product_name: product.name,
        quantity: parseInt(quantity),
        cost_price: product.cost_price,
        selling_price: product.selling_price
      }]);
    }
    
    setQuantity('');
    setSelectedProduct('');
  };

  const handleRemoveFromBasket = (productId: string) => {
    setBasket(basket.filter(item => item.product_id !== productId));
  };

  const handleConfirmBasket = async () => {
    if (!selectedSeller || basket.length === 0) return;
    setIsSubmitting(true);
    
    const insertData = basket.map(item => ({
      seller_id: selectedSeller,
      product_id: item.product_id,
      quantity: item.quantity,
      cost_price_at_transfer: item.cost_price,
      selling_price_at_transfer: item.selling_price
    }));

    const { error } = await supabase.from('stock_transfers').insert(insertData);

    if (!error) {
      // Deduct warehouse stock
      for (const item of basket) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          const newStock = (product.stock_quantity || 0) - item.quantity;
          await supabase.from('products').update({ stock_quantity: newStock }).eq('id', item.product_id);
        }
      }

      setIsSubmitting(false);
      setBasket([]);
      setSelectedSeller('');
      fetchData();
      alert("Basket transferred successfully!");
    } else {
      alert("Error: " + error.message);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row w-full h-full max-w-7xl mx-auto border-x-4 border-black bg-[#e5e5e5]">
      
      {/* Main Left Column */}
      <div className="flex-1 space-y-8 w-full p-6 md:p-8 border-b-4 lg:border-b-0 lg:border-r-4 border-black bg-white">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter uppercase mb-2">Transfer Stock</h1>
          <div className="inline-block bg-black text-white px-3 py-1 font-bold uppercase text-sm tracking-widest">
            Assign Inventory
          </div>
        </div>

        <div className="brutal-box bg-white p-6 md:p-8">
          <div className="space-y-6">
            <div>
              <label className="block text-[14px] font-black text-black uppercase mb-2">Select Receiving Seller</label>
              <select 
                className="w-full px-4 py-3 brutal-input text-[14px]"
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(e.target.value)}
              >
                <option value="">CHOOSE A SELLER...</option>
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.block})</option>
                ))}
              </select>
            </div>

            <div className="pt-6 border-t-4 border-black">
              <h3 className="text-[16px] font-black text-black mb-4 uppercase">Add Items to Basket</h3>
              <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                <div className="flex-1">
                  <label className="block text-[12px] font-black text-black mb-2 uppercase">Product</label>
                  <select 
                    className="w-full px-4 py-3 brutal-input text-[14px]"
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                  >
                    <option value="">CHOOSE PRODUCT...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock_quantity || 0})</option>
                    ))}
                  </select>
                </div>

                <div className="w-full sm:w-32">
                  <label className="block text-[12px] font-black text-black mb-2 uppercase">Quantity</label>
                  <input 
                    type="number" 
                    min="1"
                    className="w-full px-4 py-3 brutal-input text-[16px] font-black text-center"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>

                <button 
                  type="button"
                  onClick={handleAddToBasket}
                  disabled={!selectedProduct || !quantity}
                  className="brutal-btn bg-[#fde047] text-black px-6 py-3 text-[14px] disabled:opacity-50 w-full sm:w-auto"
                >
                  ADD
                </button>
              </div>
            </div>
          </div>
        </div>

        {basket.length > 0 && (
          <div className="brutal-box bg-white overflow-hidden">
            <div className="p-4 bg-black text-white flex items-center justify-between border-b-4 border-black">
              <div className="flex items-center gap-3 font-black text-[16px] uppercase tracking-tighter">
                <ShoppingBasket size={24} strokeWidth={3} />
                Transfer Basket
              </div>
              <span className="text-[12px] font-black bg-[#fde047] text-black px-3 py-1 uppercase">{basket.length} ITEMS</span>
            </div>
            <div className="divide-y-4 divide-black">
              {basket.map((item) => (
                <div key={item.product_id} className="p-4 flex justify-between items-center bg-[#e5e5e5]">
                  <div>
                    <p className="font-black text-[16px] uppercase text-black">{item.product_name}</p>
                    <p className="text-[14px] font-bold text-black mt-1 uppercase">{item.quantity} units</p>
                  </div>
                  <button 
                    onClick={() => handleRemoveFromBasket(item.product_id)}
                    className="w-10 h-10 flex items-center justify-center brutal-btn bg-[#f472b6] text-black"
                  >
                    <Trash2 size={20} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
            <div className="p-4 bg-white border-t-4 border-black">
              <button 
                type="button"
                onClick={handleConfirmBasket}
                disabled={isSubmitting || !selectedSeller}
                className="w-full brutal-btn bg-[#4ade80] text-black py-4 text-[16px] disabled:opacity-50"
              >
                {isSubmitting ? 'CONFIRMING...' : !selectedSeller ? 'SELECT SELLER' : 'CONFIRM TRANSFER'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar Column */}
      <div className="w-full lg:w-[380px] bg-white flex flex-col min-h-screen">
        <div className="p-6 bg-[#fde047] border-b-4 border-black">
          <h2 className="text-[20px] font-black text-black tracking-tighter uppercase flex items-center gap-3">
            <ArrowRight size={24} strokeWidth={3} />
            Recent Transfers
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto divide-y-4 divide-black">
          {transfers.length === 0 ? (
            <div className="p-8 text-center text-black font-black uppercase text-[14px]">No recent transfers</div>
          ) : (
            transfers.map((t) => (
              <div key={t.id} className="p-5 bg-white hover:bg-[#e5e5e5] transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <p className="font-black text-[14px] uppercase text-black leading-snug">
                    <span className="bg-black text-white px-1.5 py-0.5 mr-2">{t.quantity}X</span> {t.products?.name}
                  </p>
                  <span className="text-[10px] font-black text-black bg-[#4ade80] border-2 border-black px-2 py-1 uppercase ml-2 shrink-0">DONE</span>
                </div>
                <div className="flex items-center gap-2 text-[12px] font-bold text-black uppercase">
                  <span>TO:</span>
                  <span className="underline">{t.sellers?.name}</span>
                </div>
                <p className="text-[10px] text-black font-bold mt-2 uppercase">{new Date(t.created_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
