import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProductsPage from './pages/admin/ProductsPage';
import SellersPage from './pages/admin/SellersPage';
import StockTransferPage from './pages/admin/StockTransferPage';
import SellerDashboard from './pages/seller/SellerDashboard';
import MainLayout from './components/MainLayout';
import LoadingScreen from './components/LoadingScreen';

import DuesNotificationsPage from './pages/admin/DuesNotificationsPage';
import PassbookPage from './pages/admin/PassbookPage';
import CapitalTrackerPage from './pages/admin/CapitalTrackerPage';

function App() {
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRole = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (data) {
        setRole(data.role);
      }
    } catch {
      console.error('Error fetching role');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {!session ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <Route element={<MainLayout role={role} />}>
            {role === 'admin' ? (
              <>
                <Route path="/" element={<AdminDashboard />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/sellers" element={<SellersPage />} />
                <Route path="/transfer" element={<StockTransferPage />} />
                <Route path="/dues" element={<DuesNotificationsPage />} />
                <Route path="/passbook" element={<PassbookPage />} />
                <Route path="/capital" element={<CapitalTrackerPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : role === 'seller' ? (
              <>
                <Route path="/" element={<SellerDashboard />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : (
              <Route path="*" element={<div>Unauthorized or Profile Missing</div>} />
            )}
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
