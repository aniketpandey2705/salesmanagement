import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Bell, Send, AlertCircle, CheckCircle } from 'lucide-react';

export default function DuesNotificationsPage() {
  const [dues, setDues] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  
  const [selectedSeller, setSelectedSeller] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [duesRes, sellersRes, notesRes] = await Promise.all([
      supabase.from('orders').select('*, sellers(name)').gt('amount_due', 0).order('created_at', { ascending: false }),
      supabase.from('sellers').select('*').order('name', { ascending: true }),
      supabase.from('seller_notes').select('*, sellers(name)').order('created_at', { ascending: false }).limit(20)
    ]);

    if (duesRes.data) setDues(duesRes.data);
    if (sellersRes.data) setSellers(sellersRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    
    setLoading(false);
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeller || !message) return;
    
    setIsSubmitting(true);
    const { error } = await supabase.from('seller_notes').insert([{
      seller_id: selectedSeller,
      message,
      is_read: false
    }]);

    setIsSubmitting(false);
    
    if (!error) {
      setMessage('');
      setSelectedSeller('');
      fetchData();
      alert("Notification sent successfully!");
    } else {
      alert("Failed to send notification: " + error.message);
    }
  };

  const handleMarkPaid = async (orderId: string, totalAmount: number) => {
    if (confirm("Mark this due as fully paid?")) {
      const { error } = await supabase.from('orders').update({
        amount_paid: totalAmount,
        amount_due: 0,
        payment_status: 'paid'
      }).eq('id', orderId);

      if (!error) {
        fetchData();
      } else {
        alert("Error updating order: " + error.message);
      }
    }
  };

  const totalSystemDues = dues.reduce((acc, d) => acc + d.amount_due, 0);

  if (loading) return <div className="p-8 text-center text-black font-black uppercase text-2xl tracking-tighter">Loading...</div>;

  return (
    <div className="w-full p-6 md:p-8 pb-10 max-w-7xl mx-auto space-y-10">
      
      {/* Header Section */}
      <div className="flex flex-col justify-start items-start">
        <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter uppercase mb-2">Dues & Notifications</h1>
        <div className="inline-block bg-black text-white px-3 py-1 font-bold uppercase text-sm tracking-widest">
          Administration
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Col: Pending Dues */}
        <div className="space-y-6">
          <div className="brutal-box bg-[#f472b6] p-6 flex flex-col justify-between">
            <p className="text-[14px] font-black uppercase tracking-tighter border-b-4 border-black pb-2 mb-4">Total System Dues</p>
            <p className="text-4xl font-black tracking-tighter">₹{totalSystemDues.toFixed(0)}</p>
          </div>

          <div className="brutal-box bg-white p-6">
            <h2 className="text-2xl font-black uppercase tracking-tighter border-b-4 border-black pb-4 mb-6 flex items-center gap-3">
              <AlertCircle size={24} strokeWidth={3} />
              Outstanding Dues
            </h2>

            <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
              {dues.length === 0 ? (
                <div className="text-center p-6 text-[14px] font-black uppercase border-4 border-dashed border-black">No pending dues</div>
              ) : dues.map((due) => (
                <div key={due.id} className="brutal-box bg-[#fde047] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[18px] font-black uppercase leading-none mb-1 tracking-tighter truncate max-w-[200px]">{due.customer_name}</p>
                    <p className="text-[12px] font-black uppercase bg-white border-2 border-black inline-block px-2 py-0.5">
                      Seller: {due.sellers?.name || 'Unknown'}
                    </p>
                    <p className="text-[14px] font-bold mt-2">Total Bill: ₹{due.total_amount}</p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="text-[20px] font-black text-red-600 bg-white border-2 border-black px-3 py-1">DUE: ₹{due.amount_due}</p>
                    <button 
                      onClick={() => handleMarkPaid(due.id, due.total_amount)}
                      className="brutal-btn bg-black text-white px-4 py-2 text-[12px] flex items-center gap-2"
                    >
                      <CheckCircle size={14} strokeWidth={3} />
                      MARK PAID
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Send Notification */}
        <div className="space-y-6">
          <div className="brutal-box bg-white p-6">
            <h2 className="text-2xl font-black uppercase tracking-tighter border-b-4 border-black pb-4 mb-6 flex items-center gap-3">
              <Send size={24} strokeWidth={3} />
              Send Notification
            </h2>
            
            <form onSubmit={handleSendNotification} className="space-y-5">
              <div>
                <label className="block text-[14px] font-black uppercase mb-2">Select Seller</label>
                <select 
                  value={selectedSeller}
                  onChange={(e) => setSelectedSeller(e.target.value)}
                  className="w-full brutal-input px-4 py-3 text-[14px] uppercase font-bold bg-[#e5e5e5]"
                  required
                >
                  <option value="">-- Choose a Seller --</option>
                  {sellers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.block})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[14px] font-black uppercase mb-2">Message</label>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full brutal-input px-4 py-3 text-[14px] font-bold min-h-[120px] resize-none"
                  placeholder="TYPE YOUR MESSAGE HERE..."
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting || !selectedSeller || !message}
                className="w-full brutal-btn bg-[#4ade80] py-4 text-[16px] flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSubmitting ? 'SENDING...' : (
                  <>
                    <Bell size={20} strokeWidth={4} />
                    PUSH NOTIFICATION
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="brutal-box bg-white p-6">
             <h2 className="text-[18px] font-black uppercase tracking-tighter border-b-4 border-black pb-3 mb-4">Recent Notifications</h2>
             <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {notes.length === 0 ? (
                  <p className="text-[12px] font-bold uppercase text-gray-500">No recent notifications</p>
                ) : notes.map(note => (
                  <div key={note.id} className="p-3 border-2 border-black bg-[#e5e5e5]">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[12px] font-black uppercase tracking-tighter bg-black text-white px-2 py-0.5 inline-block">
                        TO: {note.sellers?.name}
                      </p>
                      <p className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black ${note.is_read ? 'bg-[#4ade80]' : 'bg-[#fde047]'}`}>
                        {note.is_read ? 'READ' : 'UNREAD'}
                      </p>
                    </div>
                    <p className="text-[14px] font-bold leading-tight">{note.message}</p>
                  </div>
                ))}
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
