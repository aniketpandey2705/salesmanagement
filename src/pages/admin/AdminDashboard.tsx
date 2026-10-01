import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, Calendar, ChevronDown } from 'lucide-react';

export default function AdminDashboard() {
  const [timeRange, setTimeRange] = useState('7d');
  const [showTimeRange, setShowTimeRange] = useState(false);
  
  const [stats, setStats] = useState({ 
    totalRevenue: 0, 
    totalProfit: 0, 
    todayRevenue: 0,
    todayTotalProfit: 0,
    todaySellerProfit: 0,
    todayDues: 0,
    activeShiftsRevenue: 0,
    activeShiftsTotalProfit: 0,
    activeShiftsDues: 0,
    unitsSold: 0, 
    totalProfitAllTime: 0, 
    unpaid_dues: 0 
  });
  const [topProducts, setTopProducts] = useState<any[]>([]);

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    const todayStr = new Date().toDateString();

    let salesQuery = supabase.from('sales').select('*, products(name), sellers(name, block)').order('created_at', { ascending: true });
    
    if (timeRange !== 'all') {
      const days = timeRange === '7d' ? 7 : 30;
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - days);
      salesQuery = salesQuery.gte('created_at', dateLimit.toISOString());
    }

    const [salesRes, ordersRes, shiftsRes] = await Promise.all([
      salesQuery,
      supabase.from('orders').select('*, sellers(name)').order('created_at', { ascending: false }).limit(200),
      supabase.from('seller_shifts').select('id').is('end_time', null)
    ]);

    const activeShiftIds = shiftsRes.data?.map(s => s.id) || [];

    if (salesRes.data) {
      const sales = salesRes.data;
      
      let totalRevenue = 0;
      let totalProfit = 0;
      let todayRevenue = 0;
      let todayTotalProfit = 0;
      let todaySellerProfit = 0;
      let activeShiftsRevenue = 0;
      let activeShiftsTotalProfit = 0;
      let unitsSold = 0;
      let totalProfitAllTime = 0;

      const productMap: any = {};
      const sellerMap: any = {};
      const dateMap: any = {};

      sales.forEach((s: any) => {
        totalRevenue += s.revenue;
        totalProfit += s.profit;
        unitsSold += s.quantity;
        totalProfitAllTime += s.profit;
        
        const saleDateObj = new Date(s.created_at);
        if (saleDateObj.toDateString() === todayStr) {
          todayRevenue += s.revenue;
          todayTotalProfit += s.profit;
          todaySellerProfit += s.seller_profit;
        }

        if (activeShiftIds.includes(s.shift_id)) {
          activeShiftsRevenue += s.revenue;
          activeShiftsTotalProfit += s.profit;
        }

        const dateKey = saleDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!dateMap[dateKey]) dateMap[dateKey] = 0;
        dateMap[dateKey] += s.revenue;

        const pName = s.products?.name || 'Unknown';
        if (!productMap[pName]) productMap[pName] = { name: pName, sold: 0, revenue: 0, profit: 0 };
        productMap[pName].sold += s.quantity;
        productMap[pName].revenue += s.revenue;
        productMap[pName].profit += s.owner_profit;

        const sName = s.sellers?.name || 'Unknown';
        const sBlock = s.sellers?.block || '';
        if (!sellerMap[sName]) sellerMap[sName] = { name: sName, block: sBlock, sold: 0, revenue: 0, profit: 0 };
        sellerMap[sName].sold += s.quantity;
        sellerMap[sName].revenue += s.revenue;
        sellerMap[sName].profit += s.owner_profit;
      });
      
      const chartArr = Object.keys(dateMap).map(date => ({
        name: date,
        sales: dateMap[date]
      })).slice(-7);

      let unpaid_dues = 0;
      let todayDues = 0;
      let activeShiftsDues = 0;
      if (ordersRes.data) {
        unpaid_dues = ordersRes.data.reduce((acc, order) => acc + Number(order.amount_due), 0);
        ordersRes.data.forEach((order: any) => {
          if (new Date(order.created_at).toDateString() === todayStr) {
            todayDues += Number(order.amount_due);
          }
          if (activeShiftIds.includes(order.shift_id)) {
            activeShiftsDues += Number(order.amount_due);
          }
        });
        setRecentOrders(ordersRes.data.slice(0, 20));
      }

      setChartData(chartArr.length > 0 ? chartArr : [{ name: 'Today', sales: 0 }]);
      setStats({ 
        totalRevenue, totalProfit, todayRevenue, todayTotalProfit, todaySellerProfit, todayDues, 
        activeShiftsRevenue, activeShiftsTotalProfit, activeShiftsDues,
        unitsSold, totalProfitAllTime, unpaid_dues 
      });
      setTopProducts(Object.values(productMap).sort((a:any, b:any) => b.revenue - a.revenue).slice(0, 10));
    }
    
    setLoading(false);
  };

  if (loading) return <div className="p-8 text-center text-black font-black uppercase text-2xl tracking-tighter">Loading...</div>;

  return (
    <div className="w-full p-6 md:p-8 pb-10 max-w-7xl mx-auto space-y-10">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter uppercase mb-2">Overview</h1>
          <div className="inline-block bg-black text-white px-3 py-1 font-bold uppercase text-sm tracking-widest">
            Dashboard Statistics
          </div>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setShowTimeRange(!showTimeRange)}
            className="flex items-center gap-3 brutal-btn brutal-box-yellow px-5 py-3"
          >
            <Calendar size={18} strokeWidth={3} className="text-black" />
            <span className="text-[14px] font-black uppercase text-black tracking-tighter">
              {timeRange === '7d' ? 'Last 7 Days' : timeRange === '30d' ? 'Last 30 Days' : 'All Time'}
            </span>
            <ChevronDown size={18} strokeWidth={3} className="text-black ml-2" />
          </button>
          
          {showTimeRange && (
            <div className="absolute right-0 mt-2 w-48 brutal-box bg-white z-20">
              <div className="flex flex-col divide-y-4 divide-black">
                {['7d', '30d', 'all'].map(r => (
                  <button 
                    key={r}
                    onClick={() => { setTimeRange(r); setShowTimeRange(false); }}
                    className={`w-full text-left px-5 py-3 text-[14px] font-black uppercase transition-colors hover:bg-black hover:text-white ${timeRange === r ? 'bg-black text-white' : 'text-black'}`}
                  >
                    {r === '7d' ? 'Last 7 Days' : r === '30d' ? 'Last 30 Days' : 'All Time'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today's Snapshot */}
      <div className="space-y-4">
        <h2 className="text-2xl font-black uppercase tracking-tighter border-b-4 border-black pb-2">Today's Snapshot</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="brutal-box bg-[#3b82f6] p-6 flex flex-col justify-between group hover:bg-black hover:text-white transition-colors">
            <p className="text-[14px] font-black uppercase tracking-tighter border-b-4 border-black group-hover:border-white pb-2 mb-4">Today's Revenue</p>
            <p className="text-4xl font-black tracking-tighter">₹{stats.todayRevenue.toFixed(0)}</p>
          </div>
          
          <div className="brutal-box bg-[#4ade80] p-6 flex flex-col justify-between">
            <p className="text-[14px] font-black uppercase tracking-tighter border-b-4 border-black pb-2 mb-4">Total Profit Today</p>
            <p className="text-4xl font-black tracking-tighter">₹{stats.todayTotalProfit.toFixed(0)}</p>
          </div>

          <div className="brutal-box bg-[#fde047] p-6 flex flex-col justify-between">
            <p className="text-[14px] font-black uppercase tracking-tighter border-b-4 border-black pb-2 mb-4">Sellers Cut Today</p>
            <p className="text-4xl font-black tracking-tighter">₹{stats.todaySellerProfit.toFixed(0)}</p>
          </div>

          <div className="brutal-box bg-[#f472b6] p-6 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3"><AlertCircle size={24} strokeWidth={3} /></div>
            <p className="text-[14px] font-black uppercase tracking-tighter border-b-4 border-black pb-2 mb-4">Dues Added Today</p>
            <p className="text-4xl font-black tracking-tighter">₹{stats.todayDues.toFixed(0)}</p>
          </div>
        </div>
      </div>

      {/* Active Shifts Snapshot */}
      <div className="space-y-4 pt-4">
        <h2 className="text-2xl font-black uppercase tracking-tighter border-b-4 border-black pb-2 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span> Active Shifts Snapshot
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="brutal-box bg-[#3b82f6] p-6 flex flex-col justify-between group hover:bg-black hover:text-white transition-colors">
            <p className="text-[14px] font-black uppercase tracking-tighter border-b-4 border-black group-hover:border-white pb-2 mb-4">Live Shift Revenue</p>
            <p className="text-4xl font-black tracking-tighter">₹{stats.activeShiftsRevenue.toFixed(0)}</p>
          </div>
          
          <div className="brutal-box bg-[#4ade80] p-6 flex flex-col justify-between">
            <p className="text-[14px] font-black uppercase tracking-tighter border-b-4 border-black pb-2 mb-4">Live Shift Total Profit</p>
            <p className="text-4xl font-black tracking-tighter">₹{stats.activeShiftsTotalProfit.toFixed(0)}</p>
          </div>

          <div className="brutal-box bg-[#f472b6] p-6 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3"><AlertCircle size={24} strokeWidth={3} /></div>
            <p className="text-[14px] font-black uppercase tracking-tighter border-b-4 border-black pb-2 mb-4">Live Shift Dues</p>
            <p className="text-4xl font-black tracking-tighter">₹{stats.activeShiftsDues.toFixed(0)}</p>
          </div>
        </div>
      </div>

      {/* Lifetime Overview */}
      <div className="space-y-4 pt-4">
        <h2 className="text-2xl font-black uppercase tracking-tighter border-b-4 border-black pb-2">Lifetime Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="brutal-box bg-white p-6 flex flex-col justify-between">
            <p className="text-[14px] font-black uppercase tracking-tighter border-b-4 border-black pb-2 mb-4">Total Revenue</p>
            <p className="text-4xl font-black tracking-tighter">₹{stats.totalRevenue.toFixed(0)}</p>
          </div>
          
          <div className="brutal-box bg-[#22c55e] p-6 flex flex-col justify-between">
            <p className="text-[14px] font-black uppercase tracking-tighter border-b-4 border-black pb-2 mb-4">Total System Profit</p>
            <p className="text-4xl font-black tracking-tighter">₹{stats.totalProfitAllTime.toFixed(0)}</p>
          </div>

          <div className="brutal-box bg-white p-6 flex flex-col justify-between group hover:bg-black hover:text-white transition-colors">
            <p className="text-[14px] font-black uppercase tracking-tighter border-b-4 border-black group-hover:border-white pb-2 mb-4">Total Units Sold</p>
            <p className="text-4xl font-black tracking-tighter">{stats.unitsSold}</p>
          </div>

          <div className="brutal-box bg-white p-6 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3"><AlertCircle size={24} strokeWidth={3} className="text-red-600" /></div>
            <p className="text-[14px] font-black text-red-600 uppercase tracking-tighter border-b-4 border-red-600 pb-2 mb-4">Total Unpaid Dues</p>
            <p className="text-4xl font-black text-red-600 tracking-tighter">₹{stats.unpaid_dues.toFixed(0)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="brutal-box bg-white p-6 md:p-8">
            <div className="flex justify-between items-start mb-8 border-b-4 border-black pb-4">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Sales Trend</h2>
            </div>
            
            <div className="h-[350px] w-full brutal-box bg-[#e5e5e5] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="#000" strokeWidth={2} />
                  <XAxis dataKey="name" axisLine={{stroke: '#000', strokeWidth: 4}} tickLine={{stroke: '#000', strokeWidth: 2}} tick={{ fontSize: 12, fill: '#000', fontWeight: 900 }} dy={10} />
                  <YAxis axisLine={{stroke: '#000', strokeWidth: 4}} tickLine={{stroke: '#000', strokeWidth: 2}} tick={{ fontSize: 12, fill: '#000', fontWeight: 900 }} dx={-10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '4px solid #000', borderRadius: '0', boxShadow: '4px 4px 0px 0px #000', fontSize: '14px', fontWeight: 900, textTransform: 'uppercase' }}
                    itemStyle={{ color: '#000' }}
                  />
                  <Line type="step" dataKey="sales" stroke="#000" strokeWidth={4} dot={{ r: 0 }} activeDot={{ r: 8, fill: '#fde047', stroke: '#000', strokeWidth: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Side Widgets */}
        <div className="space-y-8">
          <div className="brutal-box bg-white p-6 md:p-8">
            <h2 className="text-2xl font-black uppercase tracking-tighter border-b-4 border-black pb-4 mb-6">Top Products</h2>
            
            <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {topProducts.length === 0 ? <p className="text-[14px] font-black uppercase">No sales yet</p> : null}
              {topProducts.map((prod, i) => (
                <div key={i} className="flex justify-between items-center bg-[#fde047] brutal-box p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-black text-white flex items-center justify-center text-[14px] font-black shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-[14px] font-black uppercase leading-tight tracking-tighter truncate max-w-[120px]">{prod.name}</div>
                      <div className="text-[12px] font-bold">{prod.sold} UNITS</div>
                    </div>
                  </div>
                  <div className="text-[16px] font-black">₹{prod.revenue.toFixed(0)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="brutal-box bg-white p-6 md:p-8">
            <h2 className="text-2xl font-black uppercase tracking-tighter border-b-4 border-black pb-4 mb-6">Recent Orders</h2>
            
            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {recentOrders.length === 0 ? <p className="text-[14px] font-black uppercase">No orders yet</p> : null}
              {recentOrders.map((order) => (
                <div key={order.id} className={`brutal-box p-3 ${
                  order.payment_status === 'paid' ? 'bg-[#4ade80]' :
                  order.payment_status === 'partial' ? 'bg-[#fde047]' :
                  'bg-[#f472b6]'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-black text-[14px] uppercase tracking-tighter truncate max-w-[120px]">{order.customer_name}</span>
                    <span className="text-[10px] font-black px-2 py-1 bg-black text-white uppercase tracking-widest border-2 border-black">
                      {order.payment_status}
                    </span>
                  </div>
                  <div className="flex justify-between items-end border-t-2 border-black pt-2 mt-2">
                    <div className="text-[12px] font-bold uppercase">
                      <p>S: {order.sellers?.name}</p>
                    </div>
                    <div className="text-right text-[14px]">
                      <p className="font-black">₹{order.total_amount}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
