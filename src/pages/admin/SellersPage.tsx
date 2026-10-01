import { useState, useEffect } from 'react';
import { Plus, Eye, ShieldOff, MessageSquare, IndianRupee, Package, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function SellersPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<any>(null);
  
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New seller form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [block, setBlock] = useState('');
  const [userId, setUserId] = useState('');

  // Seller Details Modal state
  const [sellerStats, setSellerStats] = useState<any>(null);
  const [sellerInventory, setSellerInventory] = useState<any[]>([]);
  const [sellerNotes, setSellerNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Collections state
  const [collectionAmount, setCollectionAmount] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);

  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    // Fetch sellers and their total sales
    const { data: sellersData } = await supabase.from('sellers').select('*').order('created_at', { ascending: false });
    const { data: salesData } = await supabase.from('sales').select('seller_id, revenue');
    
    if (sellersData) {
      const enriched = sellersData.map(s => {
        const mySales = salesData?.filter(x => x.seller_id === s.id) || [];
        const rev = mySales.reduce((acc, curr) => acc + curr.revenue, 0);
        return { ...s, total_revenue: rev };
      });
      setSellers(enriched);
    }
    setLoading(false);
  };

  const handleAddSeller = async () => {
    if (!name || !userId) return alert("Name and Auth User ID are required.");
    const sellerCode = 'SELLER' + Math.floor(1000 + Math.random() * 9000);
    
    const { error: profileError } = await supabase.from('profiles').insert([{
      id: userId,
      full_name: name,
      role: 'seller',
      phone: phone || null
    }]);

    if (profileError && profileError.code !== '23505') {
      return alert("Error creating seller profile: " + profileError.message);
    }

    const { error } = await supabase.from('sellers').insert([{
      name, phone, block, user_id: userId, seller_code: sellerCode
    }]);

    if (!error) {
      setShowAddModal(false);
      setName(''); setPhone(''); setBlock(''); setUserId('');
      fetchSellers();
      alert("✅ Seller Linked Successfully!\n\nIMPORTANT: Please make sure to securely share the Email and Password you created in Supabase with this seller so they can log in.");
    } else {
      alert("Error adding seller: " + error.message);
    }
  };

  const openSellerDetails = async (seller: any) => {
    setSelectedSeller(seller);
    setLoadingDetails(true);

    const [invRes, orderRes, notesRes, collectRes] = await Promise.all([
      supabase.from('seller_inventory').select('*').eq('seller_id', seller.id).gt('available_quantity', 0),
      supabase.from('orders').select('amount_due, amount_paid').eq('seller_id', seller.id),
      supabase.from('seller_notes').select('*').eq('seller_id', seller.id).order('created_at', { ascending: false }),
      supabase.from('admin_collections').select('amount').eq('seller_id', seller.id)
    ]);

    let dues = 0;
    let cashInHand = 0;
    if (orderRes.data) {
      orderRes.data.forEach((o: any) => {
        dues += Number(o.amount_due);
        cashInHand += Number(o.amount_paid);
      });
    }

    let totalCollected = 0;
    if (collectRes.data) {
      totalCollected = collectRes.data.reduce((acc, c) => acc + Number(c.amount), 0);
    }

    setSellerInventory(invRes.data || []);
    setSellerStats({ 
      unpaid_dues: dues,
      cash_in_hand: cashInHand,
      total_collected: totalCollected
    });
    setSellerNotes(notesRes.data || []);
    setLoadingDetails(false);
  };

  const handleSendNote = async () => {
    if (!newNote.trim() || !selectedSeller) return;
    
    const { error } = await supabase.from('seller_notes').insert([{
      seller_id: selectedSeller.id,
      message: newNote
    }]);

    if (!error) {
      setNewNote('');
      const { data } = await supabase.from('seller_notes').select('*').eq('seller_id', selectedSeller.id).order('created_at', { ascending: false });
      if (data) setSellerNotes(data);
    }
  };

  const handleCollectCash = async () => {
    if (!collectionAmount || Number(collectionAmount) <= 0 || !selectedSeller) return alert("Enter a valid amount");
    
    setIsCollecting(true);
    const { error } = await supabase.from('admin_collections').insert([{
      seller_id: selectedSeller.id,
      amount: Number(collectionAmount)
    }]);

    if (!error) {
      setCollectionAmount('');
      openSellerDetails(selectedSeller); // Refetch stats
      alert("✅ Amount collected successfully!");
    } else {
      alert("Error: " + error.message);
    }
    setIsCollecting(false);
  };

  if (loading) return <div className="p-8 text-center text-black font-black uppercase text-2xl tracking-tighter">Loading...</div>;

  return (
    <div className="space-y-10 relative w-full p-6 md:p-8 pb-10 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter uppercase mb-2">Sellers Team</h1>
          <div className="inline-block bg-black text-white px-3 py-1 font-bold uppercase text-sm tracking-widest">
            Manage Network
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="brutal-btn bg-black text-white px-5 py-3 flex items-center gap-3 text-[14px]"
        >
          <Plus size={20} strokeWidth={3} />
          LINK SELLER
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sellers.length === 0 ? (
          <div className="col-span-full p-8 text-center brutal-box bg-white text-black font-black uppercase text-xl">No sellers found.</div>
        ) : sellers.map((s, i) => (
          <div 
            key={i} 
            onClick={() => openSellerDetails(s)}
            className="brutal-box bg-white p-6 cursor-pointer hover:bg-[#fde047] transition-colors flex flex-col justify-between"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-black text-2xl uppercase tracking-tighter mb-1">{s.name}</h3>
                <p className="text-sm font-bold uppercase">{s.block} • {s.seller_code}</p>
              </div>
              <span className={`inline-flex items-center px-2 py-1 text-xs font-black uppercase border-2 border-black ${s.is_active ? 'bg-[#4ade80] text-black' : 'bg-[#f472b6] text-black'}`}>
                {s.is_active ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6 border-t-4 border-black pt-4">
              <div>
                <p className="text-xs font-black uppercase mb-1">Total Sales</p>
                <p className="font-black text-xl text-black">₹{s.total_revenue}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase mb-1">Phone</p>
                <p className="font-bold text-md">{s.phone || 'N/A'}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t-4 border-black font-black uppercase text-sm">
              <span className="flex items-center gap-2"><Eye size={18} strokeWidth={3} /> VIEW DETAILS</span>
            </div>
          </div>
        ))}
      </div>

      {/* SELLER DETAILS MODAL */}
      {selectedSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm">
          <div className="brutal-box bg-white w-full max-w-5xl max-h-[90vh] flex flex-col relative z-10 overflow-hidden">
            
            <div className="p-6 sm:p-8 flex justify-between items-start bg-[#fde047] border-b-4 border-black">
              <div>
                <h2 className="text-4xl font-black text-black mb-2 tracking-tighter uppercase">{selectedSeller.name}</h2>
                <p className="text-sm text-black font-bold uppercase bg-white border-2 border-black inline-block px-2 py-1">{selectedSeller.block} &bull; {selectedSeller.seller_code}</p>
              </div>
              <button onClick={() => setSelectedSeller(null)} className="w-12 h-12 flex items-center justify-center brutal-btn bg-white">
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"/>
                </svg>
              </button>
            </div>

            {loadingDetails ? (
              <div className="p-10 text-center text-black font-black uppercase text-xl">Loading data...</div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-[#e5e5e5]">
                
                {/* Left Side: Stats & Inventory */}
                <div className="flex-1 p-6 sm:p-8 overflow-y-auto lg:border-r-4 border-black bg-white">
                  
                  {/* Performance Section */}
                  <div className="flex items-center gap-4 mb-6 border-b-4 border-black pb-2">
                    <h3 className="font-black text-black text-xl tracking-tighter uppercase">Performance</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="brutal-box bg-[#4ade80] p-5 flex flex-col justify-center">
                      <p className="text-[14px] text-black font-black mb-2 tracking-tighter uppercase">Total Sold</p>
                      <p className="text-[32px] font-black text-black leading-none tracking-tighter">₹{selectedSeller.total_revenue}</p>
                    </div>
                    <div className="brutal-box bg-[#f472b6] p-5 flex flex-col justify-center">
                      <p className="text-[14px] text-black font-black mb-2 tracking-tighter uppercase">Customer Dues</p>
                      <p className="text-[32px] font-black text-black leading-none tracking-tighter">₹{sellerStats?.unpaid_dues}</p>
                    </div>
                  </div>

                  {/* Collections Section */}
                  <div className="brutal-box bg-white p-6 mb-8">
                    <h4 className="text-[14px] font-black text-black uppercase tracking-tighter mb-4 border-b-4 border-black pb-2">Collections Overview</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div>
                        <p className="text-[10px] text-black font-black mb-2 uppercase">Cash in Seller's Hand</p>
                        <p className="text-[20px] font-black text-black leading-none tracking-tighter">₹{sellerStats?.cash_in_hand || 0}</p>
                      </div>
                      <div className="border-l-4 border-black pl-4">
                        <p className="text-[10px] text-[#4ade80] font-black mb-2 uppercase">- Handed Over</p>
                        <p className="text-[20px] font-black text-[#4ade80] leading-none tracking-tighter">₹{sellerStats?.total_collected || 0}</p>
                      </div>
                      <div className="border-l-4 border-black pl-4 bg-[#fde047] p-2">
                        <p className="text-[10px] text-black font-black mb-2 uppercase">Net Cash Due to Admin</p>
                        <p className="text-[24px] font-black text-black leading-none tracking-tighter">₹{(sellerStats?.cash_in_hand || 0) - (sellerStats?.total_collected || 0)}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 items-stretch mt-4 pt-4 border-t-4 border-black border-dashed">
                      <div className="flex-1 relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black font-black">₹</div>
                        <input
                          type="number"
                          placeholder="Amount Collected"
                          value={collectionAmount}
                          onChange={e => setCollectionAmount(e.target.value)}
                          className="w-full brutal-input bg-[#e5e5e5] pl-8 h-full min-h-[44px]"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const netDue = (sellerStats?.cash_in_hand || 0) - (sellerStats?.total_collected || 0);
                          setCollectionAmount(netDue.toString());
                        }}
                        className="brutal-btn bg-[#fde047] text-black px-4 font-black tracking-widest text-[10px] uppercase whitespace-nowrap min-h-[44px]"
                      >
                        SET ALL DUES
                      </button>
                      <button 
                        onClick={handleCollectCash}
                        disabled={isCollecting}
                        className="brutal-btn bg-black text-white px-6 font-black tracking-widest text-[12px] uppercase whitespace-nowrap disabled:opacity-50 min-h-[44px]"
                      >
                        {isCollecting ? 'LOGGING...' : 'LOG COLLECTION'}
                      </button>
                    </div>
                  </div>

                  {/* Inventory Section */}
                  <div className="flex items-center gap-4 mb-6 border-b-4 border-black pb-2">
                    <h3 className="font-black text-black text-xl tracking-tighter uppercase">Inventory</h3>
                  </div>

                  <div className="brutal-box bg-white overflow-hidden mb-6 lg:mb-0">
                    <div className="flex justify-between items-center p-4 bg-black text-white text-sm font-black uppercase border-b-4 border-black">
                      <span>Item</span>
                      <span>Remaining</span>
                    </div>
                    <div className="divide-y-4 divide-black">
                      {sellerInventory.length === 0 ? (
                        <div className="p-4 text-sm font-black uppercase text-center">No inventory assigned.</div>
                      ) : sellerInventory.map(item => (
                        <div key={item.product_id} className="flex justify-between items-center p-4 bg-white">
                          <span className="font-black text-black text-sm uppercase tracking-tighter">{item.product_name}</span>
                          <span className="bg-[#fde047] border-2 border-black px-3 py-1 text-xs font-black text-black uppercase">{item.available_quantity} left</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Side: Notes/Messaging */}
                <div className="w-full lg:w-[45%] flex flex-col bg-white">
                  <div className="p-6 sm:p-8 flex-1 flex flex-col min-h-[300px]">
                    <div className="flex items-center gap-4 mb-6 border-b-4 border-black pb-2">
                      <h3 className="font-black text-black text-xl tracking-tighter uppercase">Notes</h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-4">
                      {sellerNotes.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                          <MessageSquare size={32} strokeWidth={3} />
                          <div>
                            <p className="text-[14px] font-black text-black uppercase">No notes yet.</p>
                          </div>
                        </div>
                      ) : sellerNotes.map(note => (
                        <div key={note.id} className="brutal-box bg-[#e5e5e5] p-4">
                          <p className="text-sm text-black font-bold uppercase">{note.message}</p>
                          <div className="flex justify-between items-center mt-4 border-t-2 border-black pt-2">
                            <span className="text-[10px] font-black uppercase">{new Date(note.created_at).toLocaleString()}</span>
                            {note.is_read ? (
                              <span className="text-[10px] bg-[#4ade80] border-2 border-black px-2 py-1 text-black font-black uppercase">Seen</span>
                            ) : (
                              <span className="text-[10px] bg-white border-2 border-black px-2 py-1 text-black font-black uppercase">Delivered</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 sm:p-8 pt-0 bg-white">
                    <div className="flex gap-4 mt-6">
                      <input 
                        type="text" 
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        placeholder="TYPE A NOTE..."
                        onKeyDown={e => e.key === 'Enter' && handleSendNote()}
                        className="flex-1 brutal-input px-4 py-3 text-sm focus:bg-[#fde047] placeholder:text-gray-500 uppercase"
                      />
                      <button 
                        onClick={handleSendNote}
                        disabled={!newNote.trim()}
                        className="brutal-btn bg-black text-white w-14 flex items-center justify-center disabled:opacity-50"
                      >
                        <Send size={20} strokeWidth={3} className="-ml-1" />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* Link Seller Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="brutal-box bg-white w-full max-w-md flex flex-col">
            <div className="p-6 bg-[#fde047] border-b-4 border-black flex justify-between items-center">
              <h2 className="font-black text-2xl uppercase tracking-tighter">Link Seller</h2>
              <button onClick={() => setShowAddModal(false)} className="w-10 h-10 brutal-btn bg-white flex items-center justify-center">
                 <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"/>
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-5 bg-white">
              <div className="brutal-box bg-[#e5e5e5] p-4 text-xs font-bold uppercase">
                <strong>NOTE:</strong> Create user in Supabase Auth first, then paste their UID here.
              </div>
              <div>
                <label className="block text-sm font-black uppercase mb-2">Auth User ID (UUID)</label>
                <input value={userId} onChange={e=>setUserId(e.target.value)} type="text" className="w-full px-4 py-3 brutal-input text-sm font-mono" placeholder="123E4567-E89B-12D3..." />
              </div>
              <div>
                <label className="block text-sm font-black uppercase mb-2">Full Name</label>
                <input value={name} onChange={e=>setName(e.target.value)} type="text" className="w-full px-4 py-3 brutal-input text-sm" />
              </div>
              <div>
                <label className="block text-sm font-black uppercase mb-2">Phone</label>
                <input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" className="w-full px-4 py-3 brutal-input text-sm" />
              </div>
              <div>
                <label className="block text-sm font-black uppercase mb-2">Block / Area</label>
                <input value={block} onChange={e=>setBlock(e.target.value)} type="text" className="w-full px-4 py-3 brutal-input text-sm" />
              </div>
            </div>
            <div className="p-6 border-t-4 border-black bg-white flex justify-end gap-4">
              <button onClick={() => setShowAddModal(false)} className="px-6 py-3 text-sm brutal-btn bg-white">CANCEL</button>
              <button onClick={handleAddSeller} className="px-6 py-3 bg-black text-white text-sm brutal-btn hover:bg-[#4ade80] hover:text-black">LINK ACCOUNT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
