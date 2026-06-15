import { Routes, Route } from "react-router-dom";
import "./index.css";
import Header from "./components/Header";
import Toast from "./components/Toast";
import SmoothScroll from "./components/SmoothScroll";
import Dashboard from "./pages/Dashboard";
import Extract from "./pages/Extract";
import Aippt from "./pages/Aippt";
import SharePpt from "./pages/SharePpt";
import { useToast } from "./hooks/useToast";
import Signup from "./components/Signup";
import Login from "./components/login";

export default function App() {
  const { toasts, addToast } = useToast();

  return (
    <>
      <SmoothScroll />
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Header />

        <main className="flex-1 w-full relative z-10 px-4 pb-20 mt-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/extract" element={<Extract addToast={addToast} />} />
            <Route path="/aippt" element={<Aippt />} />
            <Route path="/share-ppt/:id" element={<SharePpt />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>

        <footer className="w-full py-6 mt-auto border-t border-slate-800/50 bg-slate-950/80 backdrop-blur-md relative z-20">
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-4 text-sm font-bold text-slate-500">
            <p className="flex items-center gap-2">
              <span className="text-xl">⚡</span> 
              Powered by <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 font-black tracking-wider uppercase">VisionText AI</span>
            </p>
            <p className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 border border-slate-800 rounded-full shadow-inner">
              <span className="opacity-70">Designed & Built by</span>
              <span className="text-indigo-400 font-black tracking-widest uppercase text-[10px] ml-1">Naveen & Vivek</span>
            </p>
          </div>
        </footer>

        <Toast toasts={toasts} />
      </div>
    </>
  );
}
