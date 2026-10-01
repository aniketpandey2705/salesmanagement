import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { IndianRupee, Package, TrendingUp, AlertTriangle, ArrowDownToLine } from 'lucide-react';

export default function CapitalTrackerPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalInvested: 0,
    amountReceived: 0,
    totalProfit: 0,
    moneyInTransit: 0
  });

  useEffect(() => {
    fetchCapitalData();
  }, []);

  const fetchCapitalData = async () => {
    // 1. Total Items & Total Amount Invested (from products table)
    const { data: productsData } = await supabase.from('products').select('stock_quantity, cost_price');
    let totalItems = 0;
    let totalInvested = 0;
    
    if (productsData) {
      productsData.forEach(p => {
        totalItems += Number(p.stock_quantity || 0);
        totalInvested += (Number(p.stock_quantity || 0) * Number(p.cost_price || 0));
      });
    }

    // 2. Amount Received from Sellers (from admin_collections)
    const { data: collectionsData } = await supabase.from('admin_collections').select('amount');
    let amountReceived = 0;
    if (collectionsData) {
      amountReceived = collectionsData.reduce((acc, curr) => acc + Number(curr.amount), 0);
    }

    // 3. Total Profit & Total Cost Sold (from sales)
    const { data: salesData } = await supabase.from('sales').select('profit, total_cost');
    let totalProfit = 0;
    let totalCostSold = 0;
    if (salesData) {
      salesData.forEach(s => {
        totalProfit += Number(s.profit || 0);
        totalCostSold += Number(s.total_cost || 0);
      });
    }

    // 4. Money in Transit = Total Cash Handed to Sellers - Amount Received by Admin
    const { data: ordersData } = await supabase.from('orders').select('amount_paid');
    let totalCashInField = 0;
    if (ordersData) {
      totalCashInField = ordersData.reduce((acc, o) => acc + Number(o.amount_paid), 0);
    }
    const moneyInTransit = totalCashInField - amountReceived;

    setStats({
      totalItems,
      totalInvested,
      amountReceived,
      totalProfit,
      moneyInTransit
    });

    setLoading(false);
  };

  if (loading) return <div className="p-8 text-center font-black uppercase text-2xl tracking-tighter">Loading Capital Data...</div>;

  return (
    <div className="w-full p-6 md:p-8 pb-10 max-w-7xl mx-auto space-y-10">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter uppercase mb-2">Capital Tracker</h1>
          <div className="inline-block bg-black text-white px-3 py-1 font-bold uppercase text-sm tracking-widest">
            Business Expense & Investment
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Total Amount Invested */}
        <div className="brutal-box bg-white p-6 flex flex-col justify-between group hover:bg-black hover:text-white transition-colors">
          <div className="flex items-center gap-3 mb-4 border-b-4 border-black group-hover:border-white pb-2">
            <ArrowDownToLine size={24} strokeWidth={3} />
            <p className="text-[14px] font-black uppercase tracking-tighter">Total Capital Invested</p>
          </div>
          <p className="text-5xl font-black tracking-tighter">₹{stats.totalInvested.toFixed(0)}</p>
          <p className="text-[12px] font-bold mt-2 opacity-70">Current value of unsold inventory</p>
        </div>

        {/* Total Items */}
        <div className="brutal-box bg-[#3b82f6] p-6 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4 border-b-4 border-black pb-2">
            <Package size={24} strokeWidth={3} />
            <p className="text-[14px] font-black uppercase tracking-tighter">Total Inventory Items</p>
          </div>
          <p className="text-5xl font-black tracking-tighter">{stats.totalItems}</p>
          <p className="text-[12px] font-bold mt-2">Physical stock across system</p>
        </div>

        {/* Money In Transit */}
        <div className="brutal-box bg-[#fde047] p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3"><AlertTriangle size={32} strokeWidth={3} /></div>
          <div className="flex items-center gap-3 mb-4 border-b-4 border-black pb-2">
            <TrendingUp size={24} strokeWidth={3} />
            <p className="text-[14px] font-black uppercase tracking-tighter">Money In Transit (Due)</p>
          </div>
          <p className="text-5xl font-black tracking-tighter">₹{stats.moneyInTransit.toFixed(0)}</p>
          <p className="text-[12px] font-bold mt-2">Pending collection from sellers</p>
        </div>

        {/* Amount Received */}
        <div className="brutal-box bg-[#4ade80] p-6 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4 border-b-4 border-black pb-2">
            <IndianRupee size={24} strokeWidth={3} />
            <p className="text-[14px] font-black uppercase tracking-tighter">Cash Collected</p>
          </div>
          <p className="text-5xl font-black tracking-tighter">₹{stats.amountReceived.toFixed(0)}</p>
          <p className="text-[12px] font-bold mt-2">Physically retrieved from sellers</p>
        </div>

        {/* Total Profit */}
        <div className="brutal-box bg-[#f472b6] p-6 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4 border-b-4 border-black pb-2">
            <IndianRupee size={24} strokeWidth={3} />
            <p className="text-[14px] font-black uppercase tracking-tighter">Net Profit Earned</p>
          </div>
          <p className="text-5xl font-black tracking-tighter">₹{stats.totalProfit.toFixed(0)}</p>
          <p className="text-[12px] font-bold mt-2">Total profit generated from sales</p>
        </div>

      </div>

    </div>
  );
}
