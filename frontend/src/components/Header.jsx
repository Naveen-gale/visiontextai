import { Link, useLocation, useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {
        setUser(null);
      }
    } else {
      setUser(null);
    }
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/login");
  };

  return (
    <header className="w-full flex items-center justify-between px-6 py-5 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50 sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-3 group">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
          👁️
        </div>
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-indigo-300">
            VisionText
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full uppercase tracking-wider">
            AI
          </span>
        </div>
      </Link>
      
      <div className="flex items-center gap-4">
        <Link 
          to="/extract" 
          className="hidden sm:flex text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors"
        >
          Extract Info
        </Link>
        <Link 
          to="/aippt" 
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 text-purple-300 font-bold text-sm rounded-full hover:from-purple-600/40 hover:to-indigo-600/40 hover:text-white hover:border-purple-400/60 hover:shadow-[0_4px_20px_rgba(168,85,247,0.3)] transition-all transform hover:-translate-y-0.5"
        >
          <span className="text-lg leading-none">📊</span>
          Make PPT
        </Link>

        {user ? (
          <div className="relative group">
            {/* Simple Circle Profile */}
            <button className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border border-indigo-400/40 flex items-center justify-center font-bold text-white text-base shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all">
              {user.name ? user.name[0].toUpperCase() : "U"}
            </button>
            {/* Dropdown Menu */}
            <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="px-4 py-2 border-b border-slate-800/60">
                <p className="text-xs text-slate-400 font-medium truncate">Logged in as</p>
                <p className="text-sm text-white font-semibold truncate">{user.name || "User"}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-800/50 hover:text-red-300 transition-colors cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        ) : (
          <>
            <Link to="/signup" className="hidden sm:flex text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors">
              SignUp
            </Link>
            <Link to="/login" className="hidden sm:flex text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors">
              LogIn
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
