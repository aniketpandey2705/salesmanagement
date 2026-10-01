import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, Package, Users, ArrowRightLeft, LogOut, Bell, BookOpen, Banknote } from 'lucide-react';

export default function MainLayout({ role }: { role: string | null }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const adminLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Products', path: '/products', icon: Package },
    { name: 'Sellers', path: '/sellers', icon: Users },
    { name: 'Transfer', path: '/transfer', icon: ArrowRightLeft },
    { name: 'Dues', path: '/dues', icon: Bell },
    { name: 'Passbook', path: '/passbook', icon: BookOpen },
    { name: 'Capital', path: '/capital', icon: Banknote },
  ];

  if (role === 'seller') {
    return (
      <div className="min-h-screen w-full">
        <Outlet />
      </div>
    );
  }

  // Admin Layout
  return (
    <div className="min-h-screen flex brutal-bg text-black font-brutal">
      {/* Admin Sidebar - Desktop */}
      <aside className="w-[250px] hidden md:flex flex-col bg-white border-r-[4px] border-black relative z-10">
        <div className="p-6 border-b-[4px] border-black bg-[#fde047]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 brutal-box bg-white flex items-center justify-center font-black text-black text-2xl">
              A
            </div>
            <h1 className="text-xl font-black tracking-tighter uppercase text-black">Admin Portal</h1>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-4">
          {adminLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 text-[15px] font-black uppercase transition-all ${
                  isActive
                    ? 'brutal-btn bg-black text-white'
                    : 'border-[3px] border-transparent hover:brutal-box hover:bg-[#fde047] text-black'
                }`
              }
            >
              <link.icon size={20} strokeWidth={3} />
              {link.name}
            </NavLink>
          ))}
        </nav>
        
        <div className="p-6 border-t-[4px] border-black bg-[#f472b6]">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-3 px-4 py-3 text-[14px] brutal-btn bg-white"
          >
            <LogOut size={20} strokeWidth={3} />
            LOGOUT
          </button>
        </div>
      </aside>

      {/* Admin Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-0">
        {/* Mobile Header for Admin */}
        <header className="bg-[#fde047] border-b-[4px] border-black p-4 flex justify-between items-center md:hidden relative z-10">
          <h1 className="font-black text-xl uppercase tracking-tighter">Admin</h1>
          <button onClick={handleLogout} className="text-black w-10 h-10 flex items-center justify-center brutal-btn bg-white">
            <LogOut size={18} strokeWidth={3} />
          </button>
        </header>
        
        {/* Mobile Nav for Admin */}
        <nav className="bg-white border-b-[4px] border-black flex overflow-x-auto md:hidden p-4 gap-3 relative z-10">
          {adminLinks.map((link) => (
             <NavLink
             key={link.path}
             to={link.path}
             className={({ isActive }) =>
               `flex items-center justify-center min-w-[120px] gap-2 px-4 py-3 text-[13px] font-black uppercase transition-all ${
                 isActive
                   ? 'brutal-btn bg-black text-white'
                   : 'border-[3px] border-black bg-white text-black'
               }`
             }
           >
             <link.icon size={16} strokeWidth={3} />
             {link.name}
           </NavLink>
          ))}
        </nav>

        <div className="flex-1 overflow-auto brutal-bg">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
