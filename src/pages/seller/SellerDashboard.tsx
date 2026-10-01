import { useState, useEffect } from 'react';
import { Plus, Minus, LogOut, ShoppingBag, X, Check, User, IndianRupee, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function SellerDashboard() {
  const [basket, setBasket] = useState<any[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  
  const [customerName, setCustomerName] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('paid'); // 'paid', 'unpaid', 'partial'
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  
  const [seller, setSeller] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [pendingDues, setPendingDues] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: sellerData } = await supabase
      .from('sellers')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (sellerData) {
      setSeller(sellerData);
      
      const { data: invData } = await supabase
        .from('seller_inventory')
        .select('*')
        .eq('seller_id', sellerData.id)
        .gt('available_quantity', 0);
        
      const { data: prodData } = await supabase
        .from('products')
        .select('id, selling_price, cost_price, image_url');

      if (invData && prodData) {
        const merged = invData.map((inv: any) => {
          const p = prodData.find(x => x.id === inv.product_id);
          return {
            ...inv,
            selling_price: p?.selling_price || 0,
            cost_price: p?.cost_price || 0,
            image_url: p?.image_url || null
          };
        });
        setInventory(merged);
      }

      const { data: shiftData } = await supabase
        .from('seller_shifts')
        .select('*')
        .eq('seller_id', sellerData.id)
        .is('end_time', null)
        .maybeSingle();
      
      setActiveShift(shiftData);

      let salesQuery = supabase
        .from('sales')
        .select('*, products(name)')
        .eq('seller_id', sellerData.id)
        .order('created_at', { ascending: false });

      if (shiftData) {
        salesQuery = salesQuery.eq('shift_id', shiftData.id);
      } else {
        const today = new Date();
        today.setHours(0,0,0,0);
        salesQuery = salesQuery.gte('created_at', today.toISOString());
      }
      
      const { data: salesData } = await salesQuery;
      if (salesData) setSales(salesData);

      // Fetch unread notes
      const { data: notesData } = await supabase
        .from('seller_notes')
        .select('*')
        .eq('seller_id', sellerData.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (notesData) setNotes(notesData);
        // Fetch pending dues
      const { data: duesData } = await supabase
        .from('orders')
        .select('*')
        .eq('seller_id', sellerData.id)
        .gt('amount_due', 0)
        .order('created_at', { ascending: false });

      if (duesData) setPendingDues(duesData);
    }
    setLoading(false);
  };

  const addToBasket = (prod: any) => {
    const existing = basket.find(item => item.id === prod.product_id);
    if (existing) {
      if (existing.qty < prod.available_quantity) {
        setBasket(basket.map(item => 
          item.id === prod.product_id ? { ...item, qty: item.qty + 1 } : item
        ));
      } else {
        alert("Cannot exceed available stock");
      }
    } else {
      setBasket([...basket, { 
        id: prod.product_id, 
        name: prod.product_name, 
        price: prod.selling_price, 
        cost_price: prod.cost_price,
        qty: 1,
        max_stock: prod.available_quantity,
        image_url: prod.image_url
      }]);
    }
  };

  const updateBasketQty = (id: string, delta: number) => {
    setBasket(basket.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        if (newQty > 0 && newQty <= item.max_stock) {
          return { ...item, qty: newQty };
        }
      }
      return item;
    }));
  };

  const updateBasketPrice = (id: string, newPrice: number) => {
    setBasket(basket.map(item => item.id === id ? { ...item, price: newPrice } : item));
  };

  const removeFromBasket = (id: string) => {
    setBasket(basket.filter(item => item.id !== id));
  };

  const basketTotal = basket.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCheckout = async () => {
    if (!seller || basket.length === 0 || !customerName) return alert("Customer name is required");
    
    let finalAmountPaid = 0;
    if (paymentStatus === 'paid') finalAmountPaid = basketTotal;
    else if (paymentStatus === 'partial') finalAmountPaid = Number(amountPaid);
    else finalAmountPaid = 0; // unpaid

    if (finalAmountPaid < 0 || finalAmountPaid > basketTotal) return alert("Invalid amount paid");
    
    setIsSubmitting(true);

    // 1. Create Order
    const { data: orderData, error: orderError } = await supabase.from('orders').insert([{
      seller_id: seller.id,
      customer_name: customerName,
      payment_status: paymentStatus,
      total_amount: basketTotal,
      amount_paid: finalAmountPaid,
      amount_due: basketTotal - finalAmountPaid,
      shift_id: activeShift?.id || null
    }]).select().single();

    if (orderError) {
      alert("Error creating order: " + orderError.message);
      setIsSubmitting(false);
      return;
    }

    // 2. Create Sales Entries linked to Order
    const salesInserts = basket.map(item => {
      const revenue = item.qty * item.price;
      const total_cost = item.qty * item.cost_price;
      const profit = revenue - total_cost;
      const share = profit / 2;

      return {
        order_id: orderData.id,
        seller_id: seller.id,
        product_id: item.id,
        quantity: item.qty,
        cost_price: item.cost_price,
        selling_price: item.price,
        revenue: revenue,
        total_cost: total_cost,
        profit: profit,
        seller_profit: share,
        owner_profit: share,
        shift_id: activeShift?.id || null
      };
    });

    const { error: salesError } = await supabase.from('sales').insert(salesInserts);

    setIsSubmitting(false);
    
    if (!salesError) {
      setBasket([]);
      setShowCheckout(false);
      setCustomerName('');
      setPaymentStatus('paid');
      setAmountPaid('');
      fetchData(); 
      alert("Sale recorded successfully!");
    } else {
      alert("Error recording sales: " + salesError.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const markNoteAsRead = async (noteId: string) => {
    setNotes(notes.filter(n => n.id !== noteId));
    await supabase.from('seller_notes').update({ is_read: true }).eq('id', noteId);
  };

  const toggleShift = async () => {
    if (activeShift) {
      // Close shift
      if (confirm("Are you sure you want to CLOSE your current sale session?")) {
        await supabase.from('seller_shifts').update({ end_time: new Date().toISOString() }).eq('id', activeShift.id);
        fetchData();
      }
    } else {
      // Open shift
      await supabase.from('seller_shifts').insert({ seller_id: seller.id });
      fetchData();
    }
  };

  const handleMarkPaid = async (orderId: string, totalAmount: number) => {
    if (confirm("Mark this customer's due as fully paid?")) {
      const { error } = await supabase.from('orders').update({
        amount_paid: totalAmount,
        amount_due: 0,
        payment_status: 'paid'
      }).eq('id', orderId);

      if (!error) {
        fetchData();
        alert("✅ Customer due cleared successfully!");
      } else {
        alert("Error updating order: " + error.message);
      }
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-[#fafaf9]">
      <div className="animate-pulse w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
    </div>
  );

  const totalSales = sales.reduce((acc, s) => acc + s.revenue, 0);
  const totalProfit = sales.reduce((acc, s) => acc + (s.profit || s.seller_profit * 2), 0);
  const myCut = sales.reduce((acc, s) => acc + s.seller_profit, 0);
  
  const shiftDues = pendingDues.filter(d => {
    if (activeShift) return d.shift_id === activeShift.id;
    return new Date(d.created_at).toDateString() === new Date().toDateString();
  }).reduce((acc, d) => acc + d.amount_due, 0);

  const statsTitle = activeShift ? "Shift" : "Today's";

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden brutal-bg font-brutal text-black lg:p-6 flex justify-center items-start">
      <div className="w-full max-w-6xl mx-auto bg-white border-x-4 border-black min-h-screen lg:min-h-0 lg:h-full lg:border-y-4 relative flex flex-col lg:flex-row lg:shadow-[12px_12px_0_0_#000] lg:overflow-hidden">
        
        {/* LEFT COLUMN: Profile, Stats, Notes */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col border-b-4 lg:border-b-0 lg:border-r-4 border-black bg-white shrink-0 lg:h-full lg:overflow-y-auto custom-scrollbar">
          <div className="p-5 lg:p-8 space-y-8">
            {/* Header */}
            <div className="flex justify-between items-start border-b-4 border-black pb-4">
              <div>
                <p className="text-[12px] font-black uppercase mb-1">Welcome</p>
                <h1 className="text-3xl font-black tracking-tighter uppercase mb-1 leading-none break-all">
                  {seller?.name || 'SELLER'}
                </h1>
                <p className="text-[12px] font-black uppercase bg-[#fde047] border-2 border-black inline-block px-2 py-0.5 mt-2">
                  {seller?.block || 'BLOCK'} &middot; ID: {seller?.seller_code}
                </p>
              </div>
              
              <button 
                onClick={handleLogout}
                className="brutal-btn bg-[#f472b6] text-black p-3 flex items-center justify-center shrink-0"
              >
                <LogOut size={20} strokeWidth={3} />
              </button>
            </div>

            <button 
              onClick={toggleShift}
              className={`w-full py-4 text-[18px] flex items-center justify-center gap-3 ${activeShift ? 'brutal-btn bg-black text-white' : 'brutal-btn bg-[#4ade80] text-black'}`}
            >
              {activeShift ? 'CLOSE SALE SESSION' : 'OPEN SALE SESSION'}
            </button>

            {/* Stats Surface */}
            {/* Stats Surface */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="brutal-box bg-[#3b82f6] p-4 text-black flex flex-col justify-between">
                <p className="text-[12px] font-black uppercase mb-2 border-b-2 border-black pb-1">{statsTitle} Sales</p>
                <p className="text-2xl lg:text-3xl font-black tracking-tighter break-all">₹{totalSales}</p>
              </div>
              
              <div className="brutal-box bg-[#4ade80] p-4 text-black flex flex-col justify-between">
                <p className="text-[12px] font-black uppercase mb-2 border-b-2 border-black pb-1">Total Profit ({statsTitle})</p>
                <p className="text-2xl lg:text-3xl font-black tracking-tighter break-all">₹{totalProfit.toFixed(0)}</p>
              </div>

              <div className="brutal-box bg-[#f472b6] p-4 text-black flex flex-col justify-between sm:col-span-2">
                <p className="text-[12px] font-black uppercase mb-2 border-b-2 border-black pb-1">Your Cut (50%)</p>
                <p className="text-2xl lg:text-3xl font-black tracking-tighter break-all">₹{myCut.toFixed(0)}</p>
              </div>

              <div className="brutal-box bg-[#fde047] p-4 text-black flex flex-col justify-between sm:col-span-2">
                <p className="text-[12px] font-black uppercase mb-2 border-b-2 border-black pb-1">{statsTitle} Dues (Unpaid)</p>
                <p className="text-2xl lg:text-3xl font-black tracking-tighter break-all text-red-600">₹{shiftDues}</p>
              </div>
            </div>

            {/* Admin Messages / Notes */}
            {notes.length > 0 && (
              <div className="space-y-4">
                {notes.map(note => (
                  <div key={note.id} className="brutal-box bg-[#e5e5e5] p-5">
                    <p className="text-[14px] font-black uppercase tracking-tighter mb-2 border-b-2 border-black pb-1">MESSAGE FROM ADMIN</p>
                    <p className="text-[14px] font-bold uppercase leading-snug">{note.message}</p>
                    <button 
                      onClick={() => markNoteAsRead(note.id)}
                      className="mt-4 brutal-btn bg-black text-white w-full py-2 text-[12px]"
                    >
                      MARK READ
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Pending Dues Notification Section */}
            {pendingDues.length > 0 && (
              <div className="brutal-box bg-white">
                <h4 className="text-[14px] font-black uppercase border-b-4 border-black p-4 bg-black text-white">Pending Dues</h4>
                <div className="divide-y-4 divide-black">
                  {pendingDues.map((order, idx) => (
                    <div key={order.id || idx} className="p-4 flex justify-between items-center bg-[#fde047]">
                      <div>
                        <p className="font-black text-[16px] uppercase tracking-tighter">{order.customer_name}</p>
                        <p className="text-[12px] font-black uppercase">TOTAL: ₹{order.total_amount}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <p className="font-black text-[18px] text-red-600 bg-white border-2 border-black px-2 py-1">DUE: ₹{order.amount_due}</p>
                        <button
                          onClick={() => handleMarkPaid(order.id, order.total_amount)}
                          className="brutal-btn bg-black text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                        >
                          <Check size={12} strokeWidth={3} />
                          CLEAR DUE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Available Stock */}
        <div className="flex-1 flex flex-col bg-[#e5e5e5] min-h-[500px] lg:min-h-0 lg:h-full relative lg:overflow-hidden">
          <div className="p-5 lg:p-6 border-b-4 border-black bg-[#fde047] flex items-center justify-between shrink-0 sticky lg:static top-0 z-10">
            <h2 className="text-2xl lg:text-3xl font-black tracking-tighter uppercase">Available Stock</h2>
            <span className="text-[14px] font-black bg-black text-white px-3 py-1">{inventory.length} ITEMS</span>
          </div>
          
          <div className="p-5 lg:p-6 overflow-y-auto flex-1 pb-32 lg:pb-6 custom-scrollbar space-y-4">
            {inventory.length === 0 ? (
              <div className="text-center py-10 brutal-box bg-white text-[14px] font-black uppercase">
                No stock available.
              </div>
            ) : inventory.map((prod) => {
              const inBasket = basket.find(b => b.id === prod.product_id);
              return (
                <div key={prod.product_id} className="brutal-box bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Name and Price */}
                  <div className="flex-1">
                    <h3 className="font-black text-[18px] uppercase leading-tight tracking-tighter">{prod.product_name}</h3>
                    <p className="text-[16px] font-black mt-1">₹{prod.selling_price}</p>
                  </div>
                  
                  {/* Middle: Quantity */}
                  <div className="text-left sm:text-center sm:px-6 border-y-2 sm:border-y-0 sm:border-x-2 border-black py-3 sm:py-1 shrink-0">
                    <p className="font-black text-2xl leading-none inline-block sm:block mr-3 sm:mr-0">{prod.available_quantity}</p>
                    <p className="text-[10px] font-black uppercase bg-[#fde047] border-2 border-black px-1 mt-1 sm:mt-1 inline-block align-middle sm:align-baseline">LEFT</p>
                  </div>
                  
                  {/* Right: Add Action */}
                  <div className="w-full sm:w-[140px] shrink-0">
                    {inBasket ? (
                      <div className="flex items-center justify-between brutal-box bg-[#e5e5e5] p-1 border-[2px]">
                        <button onClick={() => updateBasketQty(prod.product_id, -1)} className="w-10 h-10 brutal-btn bg-[#f472b6] flex items-center justify-center shrink-0 border-[2px]"><Minus size={18} strokeWidth={3}/></button>
                        <span className="font-black text-[20px] px-2">{inBasket.qty}</span>
                        <button onClick={() => updateBasketQty(prod.product_id, 1)} className="w-10 h-10 brutal-btn bg-[#4ade80] flex items-center justify-center shrink-0 border-[2px]"><Plus size={18} strokeWidth={3}/></button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => addToBasket(prod)}
                        className="w-full brutal-btn bg-black text-white py-3 text-[14px] flex items-center justify-center gap-2"
                      >
                        <ShoppingBag size={18} strokeWidth={3} />
                        ADD
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Basket Button */}
        {basket.length > 0 && !showCheckout && (
          <div className="fixed bottom-6 left-5 right-5 lg:absolute lg:bottom-8 lg:right-8 lg:left-auto lg:w-[400px] z-20">
            <button 
              onClick={() => setShowCheckout(true)}
              className="w-full brutal-btn bg-[#fde047] border-[4px] border-black text-black p-4 flex items-center justify-between shadow-[8px_8px_0_0_#000]"
            >
              <div className="flex items-center gap-4">
                <ShoppingBag size={28} strokeWidth={3} />
                <div className="text-left border-l-4 border-black pl-4">
                  <p className="text-[12px] font-black uppercase leading-none mb-1">Review</p>
                  <p className="font-black text-[18px] leading-none">{basket.length} items</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-[24px] leading-none tracking-tighter">₹{basketTotal}</p>
              </div>
            </button>
          </div>
        )}

        {/* Checkout Modal */}
        {showCheckout && (
          <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center lg:p-6">
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowCheckout(false)}
            ></div>
            
            <div className="w-full lg:max-w-3xl h-[95%] lg:h-auto lg:max-h-[90vh] bg-white border-t-4 lg:border-4 border-black relative z-10 flex flex-col lg:shadow-[16px_16px_0_0_#000]">
              <div className="p-5 border-b-4 border-black flex justify-between items-center bg-[#4ade80] shrink-0">
                <div>
                  <h3 className="font-black text-3xl uppercase tracking-tighter">Checkout</h3>
                  <p className="text-[12px] font-black uppercase bg-white border-2 border-black inline-block px-2 py-0.5 mt-1">{basket.length} ITEMS</p>
                </div>
                <button 
                  onClick={() => setShowCheckout(false)} 
                  className="w-12 h-12 flex items-center justify-center brutal-btn bg-white shrink-0"
                >
                  <X size={24} strokeWidth={3} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 lg:p-6 space-y-8 bg-[#e5e5e5]">
                
                {/* Review Basket */}
                <div className="brutal-box bg-white">
                  <h4 className="text-[14px] font-black uppercase border-b-4 border-black p-4 bg-black text-white">Order Details</h4>
                  <div className="divide-y-4 divide-black">
                    {basket.map(item => (
                      <div key={item.id} className="p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1 pr-4">
                            <p className="font-black text-[18px] uppercase tracking-tighter leading-tight">{item.name}</p>
                            <button onClick={() => removeFromBasket(item.id)} className="text-[12px] font-black text-white bg-[#f472b6] border-2 border-black px-2 mt-2 uppercase">Remove</button>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-black text-[20px]">₹{item.price * item.qty}</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 brutal-box bg-[#fde047] p-2">
                          <div className="bg-black text-white px-3 py-2 font-black text-[16px] text-center sm:text-left">
                            {item.qty}X
                          </div>
                          <div className="flex-1 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[16px] font-black">₹</span>
                            <input 
                              type="number" 
                              value={item.price}
                              onChange={(e) => updateBasketPrice(item.id, Number(e.target.value) || 0)}
                              className={`w-full brutal-input pl-8 pr-8 py-3 text-[16px] uppercase ${item.price < item.cost_price ? 'bg-[#f472b6]' : 'bg-white'}`}
                            />
                            <Pencil size={18} strokeWidth={3} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                        {item.price < item.cost_price && (
                          <p className="text-[12px] font-black text-black bg-[#f472b6] border-2 border-black p-2 mt-3 uppercase text-center">
                            SELLING BELOW COST! (Cost: ₹{item.cost_price})
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer Details */}
                <div className="brutal-box bg-white">
                  <h4 className="text-[14px] font-black uppercase border-b-4 border-black p-4 bg-black text-white">Payment</h4>
                  
                  <div className="p-4 space-y-5">
                    <div>
                      <label className="block text-[12px] font-black uppercase mb-2">Customer Name</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <User size={20} strokeWidth={3} />
                        </div>
                        <input 
                          type="text" 
                          placeholder="NAME" 
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 brutal-input text-[16px] uppercase"
                        />
                      </div>
                    </div>

                    <div>
                       <label className="block text-[12px] font-black uppercase mb-2">Payment Status</label>
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button 
                          onClick={() => setPaymentStatus('paid')}
                          className={`py-3 text-[14px] brutal-btn ${paymentStatus === 'paid' ? 'bg-black text-white' : 'bg-white'}`}
                        >
                          PAID
                        </button>
                        <button 
                          onClick={() => setPaymentStatus('partial')}
                          className={`py-3 text-[14px] brutal-btn ${paymentStatus === 'partial' ? 'bg-[#fde047] text-black' : 'bg-white'}`}
                        >
                          PARTIAL
                        </button>
                        <button 
                          onClick={() => setPaymentStatus('unpaid')}
                          className={`py-3 text-[14px] brutal-btn ${paymentStatus === 'unpaid' ? 'bg-[#f472b6] text-black' : 'bg-white'}`}
                        >
                          UNPAID
                        </button>
                      </div>
                    </div>

                    {paymentStatus === 'partial' && (
                      <div className="brutal-box bg-[#fde047] p-4">
                        <label className="block text-[12px] font-black uppercase mb-2">Amount Paid Now</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <IndianRupee size={20} strokeWidth={3} />
                          </div>
                          <input 
                            type="number" 
                            placeholder="AMOUNT" 
                            value={amountPaid}
                            onChange={e => setAmountPaid(e.target.value ? Number(e.target.value) : '')}
                            className="w-full pl-12 pr-4 py-4 brutal-input text-[20px]"
                          />
                        </div>
                        <div className="mt-3 bg-white border-2 border-black p-2 flex justify-between font-black uppercase text-[14px]">
                          <span>Remaining Due:</span>
                          <span className="text-red-600">₹{basketTotal - (Number(amountPaid) || 0)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-5 border-t-4 border-black bg-white shrink-0">
                <div className="flex justify-between items-end mb-4 bg-black text-white p-3 brutal-box border-none shadow-none">
                  <p className="text-[16px] font-black uppercase">Grand Total</p>
                  <p className="text-[32px] font-black tracking-tighter leading-none">₹{basketTotal}</p>
                </div>
                
                <button 
                  onClick={handleCheckout}
                  disabled={isSubmitting || basket.length === 0 || !customerName}
                  className="w-full brutal-btn bg-[#4ade80] py-4 text-[18px] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isSubmitting ? 'PROCESSING...' : (
                    <>
                      <Check size={24} strokeWidth={4} />
                      COMPLETE SALE
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
