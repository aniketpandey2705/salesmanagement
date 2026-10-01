import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { BookOpen, Calendar, ArrowDownCircle, ArrowUpCircle, Filter } from 'lucide-react';

export default function PassbookPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'none' | 'shift' | 'day' | 'week' | 'month'>('none');

  // Stats
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalSystemProfit, setTotalSystemProfit] = useState(0);

  useEffect(() => {
    fetchPassbook();
  }, []);

  const fetchPassbook = async () => {
    // Fetch all orders
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*, sellers(name)')
      .order('created_at', { ascending: false });

    // Fetch all sales to calculate Total Profit per order
    const { data: salesData } = await supabase
      .from('sales')
      .select('order_id, profit, revenue');

    if (ordersData && salesData) {
      // Map sales to orders
      const orderProfits: Record<string, number> = {};
      salesData.forEach((s: any) => {
        if (!orderProfits[s.order_id]) orderProfits[s.order_id] = 0;
        orderProfits[s.order_id] += s.profit;
      });

      const mergedOrders = ordersData.map(o => ({
        ...o,
        total_profit: orderProfits[o.id] || 0
      }));

      setOrders(mergedOrders);

      // Calculate totals
      let rev = 0;
      let coll = 0;
      let prof = 0;
      mergedOrders.forEach(o => {
        rev += Number(o.total_amount);
        coll += Number(o.amount_paid);
        prof += Number(o.total_profit);
      });

      setTotalRevenue(rev);
      setTotalCollected(coll);
      setTotalSystemProfit(prof);
    }
    setLoading(false);
  };

  const handleMarkPaid = async (orderId: string, totalAmount: number) => {
    if (confirm("Mark this customer's due as fully paid?")) {
      const { error } = await supabase.from('orders').update({
        amount_paid: totalAmount,
        amount_due: 0,
        payment_status: 'paid'
      }).eq('id', orderId);

      if (!error) {
        fetchPassbook();
        alert("✅ Due cleared successfully!");
      } else {
        alert("Error updating order: " + error.message);
      }
    }
  };

  const displayData = useMemo(() => {
    if (groupBy === 'none') return orders;

    const map: Record<string, any> = {};

    orders.forEach(o => {
      let key = '';
      const d = new Date(o.created_at);

      if (groupBy === 'shift') {
        key = o.shift_id ? `SHIFT ID: ${o.shift_id.substring(0,8).toUpperCase()}` : 'NO SHIFT RECORDED';
      } else if (groupBy === 'day') {
        key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } else if (groupBy === 'week') {
        const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
        const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
        const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        key = `Week ${weekNum}, ${d.getFullYear()}`;
      } else if (groupBy === 'month') {
        key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }

      if (!map[key]) {
        map[key] = {
          id: key,
          label: key,
          total_amount: 0,
          amount_paid: 0,
          amount_due: 0,
          admin_profit: 0,
          order_count: 0
        };
      }
      
      map[key].total_amount += Number(o.total_amount);
      map[key].amount_paid += Number(o.amount_paid);
      map[key].amount_due += Number(o.amount_due);
      map[key].admin_profit += Number(o.total_profit);
      map[key].order_count += 1;
    });

    return Object.values(map);
  }, [orders, groupBy]);

  if (loading) return <div className="p-8 text-center text-black font-black uppercase text-2xl tracking-tighter">Loading Passbook...</div>;

  return (
    <div className="w-full p-6 md:p-8 pb-10 max-w-7xl mx-auto space-y-10">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter uppercase mb-2">Master Ledger</h1>
          <div className="inline-block bg-black text-white px-3 py-1 font-bold uppercase text-sm tracking-widest">
            Transaction Passbook
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="brutal-box bg-white p-6 flex flex-col justify-between">
          <p className="text-[14px] font-black uppercase tracking-tighter border-b-4 border-black pb-2 mb-4">Total System Value</p>
          <p className="text-4xl font-black tracking-tighter flex items-center gap-2">
            ₹{totalRevenue.toFixed(0)}
          </p>
        </div>
        
        <div className="brutal-box bg-[#4ade80] p-6 flex flex-col justify-between">
          <p className="text-[14px] font-black uppercase tracking-tighter border-b-4 border-black pb-2 mb-4">Total Cash Collected</p>
          <p className="text-4xl font-black tracking-tighter">₹{totalCollected.toFixed(0)}</p>
        </div>
        
        <div className="brutal-box bg-[#fde047] p-6 flex flex-col justify-between">
          <p className="text-[14px] font-black uppercase tracking-tighter border-b-4 border-black pb-2 mb-4">Total System Profit</p>
          <p className="text-4xl font-black tracking-tighter">₹{totalSystemProfit.toFixed(0)}</p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="brutal-box bg-white overflow-hidden">
        <div className="p-6 bg-black text-white border-b-4 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BookOpen size={24} strokeWidth={3} />
            <h2 className="text-2xl font-black uppercase tracking-tighter">Transaction History</h2>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-black uppercase flex items-center gap-1 mr-2"><Filter size={14} /> Group By:</span>
            {['none', 'shift', 'day', 'week', 'month'].map(type => (
              <button 
                key={type}
                onClick={() => setGroupBy(type as any)}
                className={`border-2 border-white px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${groupBy === type ? 'bg-white text-black' : 'bg-black text-white hover:bg-white/20'}`}
              >
                {type === 'none' ? 'ALL' : type}
              </button>
            ))}
          </div>
        </div>
        
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="text-[12px] text-black font-black uppercase bg-[#e5e5e5] sticky top-0 z-10 border-b-4 border-black">
              {groupBy === 'none' ? (
                <tr>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Seller & Customer</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Bill Total</th>
                  <th className="px-6 py-4 text-right">Paid</th>
                  <th className="px-6 py-4 text-right">Due</th>
                  <th className="px-6 py-4 text-right border-l-4 border-black bg-[#fde047]">Total Profit</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-4">Period / Group</th>
                  <th className="px-6 py-4 text-center">Total Orders</th>
                  <th className="px-6 py-4 text-right">Total Revenue</th>
                  <th className="px-6 py-4 text-right">Total Collected</th>
                  <th className="px-6 py-4 text-right">Total Due</th>
                  <th className="px-6 py-4 text-right border-l-4 border-black bg-[#fde047]">Total Profit</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y-2 divide-black">
              {displayData.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[14px] font-black uppercase text-black">No transactions found.</td></tr>
              ) : (
                displayData.map((row: any, idx: number) => {
                  if (groupBy === 'none') {
                    // Rendering individual order
                    const dateObj = new Date(row.created_at);
                    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <tr key={row.id} className="hover:bg-[#f3f4f6] transition-colors bg-white">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 font-bold text-[14px] uppercase text-black">
                            <Calendar size={16} />
                            {dateStr}
                          </div>
                          <div className="text-[12px] text-gray-500 font-bold ml-6 mt-1">{timeStr}</div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-black text-[16px] text-black uppercase tracking-tighter">{row.customer_name}</p>
                          <p className="text-[12px] text-black font-bold uppercase">VIA: {row.sellers?.name}</p>
                          {row.shift_id && (
                            <span className="inline-block mt-1 bg-black text-white px-2 py-0.5 text-[10px] font-black tracking-widest uppercase">
                              SHIFT: {row.shift_id.substring(0, 8)}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`font-black text-[10px] uppercase px-3 py-1 border-2 border-black ${
                            row.payment_status === 'paid' ? 'bg-[#4ade80] text-black' :
                            row.payment_status === 'partial' ? 'bg-[#fde047] text-black' :
                            'bg-[#f472b6] text-black'
                          }`}>
                            {row.payment_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-black text-[16px]">₹{row.total_amount}</td>
                        <td className="px-6 py-4 text-right font-black text-[#4ade80] text-[16px]">₹{row.amount_paid}</td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-black text-[#f472b6] text-[16px]">₹{row.amount_due}</p>
                          {row.amount_due > 0 && (
                            <button
                              onClick={() => handleMarkPaid(row.id, row.total_amount)}
                              className="mt-1 bg-black text-white px-2 py-1 text-[10px] font-black uppercase tracking-widest inline-block whitespace-nowrap"
                            >
                              CLEAR DUE
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right border-l-4 border-black bg-[#fdf8d5]">
                          <span className="font-black text-[16px] text-black">₹{row.total_profit ? row.total_profit.toFixed(0) : row.admin_profit.toFixed(0)}</span>
                        </td>
                      </tr>
                    );
                  } else {
                    // Rendering aggregated row
                    return (
                      <tr key={row.id} className="hover:bg-[#f3f4f6] transition-colors bg-white">
                        <td className="px-6 py-4 font-black text-[16px] text-black uppercase tracking-tighter">
                          {row.label}
                        </td>
                        <td className="px-6 py-4 text-center font-black text-[16px] text-black">
                          {row.order_count}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-black text-[16px]">₹{row.total_amount}</td>
                        <td className="px-6 py-4 text-right font-black text-[#4ade80] text-[16px]">₹{row.amount_paid}</td>
                        <td className="px-6 py-4 text-right font-black text-[#f472b6] text-[16px]">₹{row.amount_due}</td>
                        <td className="px-6 py-4 text-right border-l-4 border-black bg-[#fdf8d5]">
                          <span className="font-black text-[16px] text-black">₹{row.total_profit ? row.total_profit.toFixed(0) : row.admin_profit.toFixed(0)}</span>
                        </td>
                      </tr>
                    );
                  }
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
