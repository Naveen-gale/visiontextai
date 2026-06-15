import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiLogin } from '../utils/api';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const data = await apiLogin(formData);
      localStorage.setItem('token', data.user.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      alert('Login successful!');
      navigate('/');
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      
      {/* High-Transparency Glass Card */}
      <div className="w-full max-w-md p-8 bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
        
        <h2 className="text-2xl font-semibold text-white text-center mb-8 tracking-wide">
          Welcome Back
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Email / Gmail Field */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-white/30"
              placeholder="example@gmail.com"
              required
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-white/30"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Static Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-white text-slate-950 font-semibold rounded-lg disabled:opacity-40"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
          
        </form>
      </div>
    </div>
  );
}