import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen brutal-bg font-brutal text-black flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border-4 border-black relative shadow-[16px_16px_0_0_#000]">
        
        {/* Header Area */}
        <div className="p-8 border-b-4 border-black bg-[#fde047]">
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-2 leading-none">Snack<br/>Dist.</h1>
          <p className="text-[12px] font-black uppercase bg-black text-white inline-block px-3 py-1 mt-4">
            AUTHORIZED PERSONNEL ONLY
          </p>
        </div>

        {/* Form Area */}
        <div className="p-8 bg-[#e5e5e5]">
          {error && (
            <div className="mb-6 p-4 bg-[#f472b6] border-4 border-black text-black font-black uppercase text-[12px] text-center shadow-[4px_4px_0_0_#000]">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[14px] font-black uppercase mb-2 border-b-2 border-black pb-1 inline-block">Email Address</label>
              <input
                type="email"
                required
                className="w-full brutal-input px-4 py-4 text-[16px] uppercase"
                placeholder="USER@SNACKDIST.COM"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[14px] font-black uppercase mb-2 border-b-2 border-black pb-1 inline-block">Password</label>
              <input
                type="password"
                required
                className="w-full brutal-input px-4 py-4 text-[16px] uppercase"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full brutal-btn bg-[#4ade80] py-5 text-[18px] flex items-center justify-center gap-3 mt-4 disabled:opacity-50"
            >
              {loading ? 'AUTHENTICATING...' : 'SECURE LOGIN'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
