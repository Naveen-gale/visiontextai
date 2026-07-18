import { Link, useLocation, useNavigate } from "react-router-dom";
import React, { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const profileRef = useRef(null);

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
    // Close menus on route change
    setShowMobileMenu(false);
    setShowProfileMenu(false);
  }, [location]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setShowProfileMenu(false);
    navigate("/login");
  };

  return (
    <header className="w-full flex items-center justify-between px-6 py-4 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      {/* Brand Logo */}
      <Link to="/" className="flex items-center gap-2 group">
        <span className="font-bold text-xl tracking-tight text-slate-100 group-hover:text-indigo-400 transition-colors">
          VisionText
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md uppercase tracking-wide">
          AI
        </span>
      </Link>
      
      {/* Navigation (Desktop) */}
      <div className="hidden md:flex items-center gap-5">
        <Link to="https://nehal-ppt-ai.onrender.com/" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors">
          NEHAL PPT AI
        </Link>
        <Link to="/extract" className="text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors">
          Extract Info
        </Link>
        <Link to="/aippt" className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors">
          Make PPT
        </Link>
        <div className="w-px h-6 bg-slate-800 mx-1"></div>

        {user ? (
          <div className="relative cursor-pointer" ref={profileRef}>
            <div onClick={() => setShowProfileMenu(!showProfileMenu)} className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-semibold text-slate-200 text-sm hover:border-indigo-500 transition-colors">
              {user.name ? user.name[0].toUpperCase() : "U"}
            </div>
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/30 border-b border-slate-800">
                  <p className="text-xs text-slate-500 font-medium">Logged in as</p>
                  <p className="text-sm text-slate-200 font-semibold truncate">{user.name || "User"}</p>
                </div>
                <div className="py-1">
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-800/50 hover:text-red-300 transition-colors">
                    Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors">Log In</Link>
            <Link to="/signup" className="flex items-center justify-center px-4 py-2 bg-slate-800 text-slate-100 text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">Sign Up</Link>
          </div>
        )}
      </div>

      {/* Mobile Hamburger Button */}
      <div className="md:hidden flex items-center gap-4">
        {user && (
          <div className="relative cursor-pointer" ref={profileRef}>
            <div onClick={() => setShowProfileMenu(!showProfileMenu)} className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-semibold text-slate-200 text-sm hover:border-indigo-500 transition-colors">
              {user.name ? user.name[0].toUpperCase() : "U"}
            </div>
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/30 border-b border-slate-800">
                  <p className="text-xs text-slate-500 font-medium">Logged in as</p>
                  <p className="text-sm text-slate-200 font-semibold truncate">{user.name || "User"}</p>
                </div>
                <div className="py-1">
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-800/50 hover:text-red-300 transition-colors">
                    Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
          {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {showMobileMenu && (
        <div className="absolute top-full left-0 w-full bg-slate-950 border-b border-slate-800 flex flex-col px-6 py-4 gap-4 md:hidden z-40 shadow-2xl">
          <Link to="https://nehal-ppt-ai.onrender.com/" target="_blank" rel="noopener noreferrer" className="text-base font-medium text-slate-300 hover:text-white">NEHAL PPT AI</Link>
          <Link to="/extract" className="text-base font-medium text-slate-300 hover:text-white">Extract Info</Link>
          <Link to="/aippt" className="text-base font-bold text-indigo-400 hover:text-indigo-300">Make PPT</Link>
          
          {!user && (
            <div className="flex flex-col gap-3 mt-2 pt-4 border-t border-slate-800">
              <Link to="/login" className="text-base font-medium text-slate-300 text-center py-2 border border-slate-800 rounded-lg">Log In</Link>
              <Link to="/signup" className="text-base font-bold text-white bg-indigo-600 text-center py-2 rounded-lg">Sign Up</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}