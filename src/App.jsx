import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { LayoutDashboard, Tv, Receipt, Menu, X, Users as UsersIcon, LogOut, ShieldCheck, User } from 'lucide-react';
import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Dashboard from './pages/Dashboard';
import Platforms from './pages/Platforms';
import Sales from './pages/Sales';
import Distributors from './pages/Distributors';
import Users from './pages/Users';
import Clients from './pages/Clients';
import Login from './pages/Login';

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const { user, userMetadata, loading, logout } = useAuth();

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = async () => {
    try {
      await logout();
      setIsLogoutModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Guardián de carga global
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Si no hay usuario O el usuario está desactivado, solo mostramos login
  if (!user || userMetadata?.active === false) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <div className="flex bg-slate-900 min-h-screen w-full font-sans text-slate-100">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-slate-900/40 backdrop-blur-xl border-r border-slate-800 p-6 transition-transform duration-300 z-30 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <ShieldCheck className="text-white" size={24} />
            </div>
            <h1 className="text-xl font-black italic tracking-tighter uppercase whitespace-nowrap">Grupoxua</h1>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col h-[calc(100vh-140px)]">
          <nav className="space-y-2 flex-1">
            <Link to="/" onClick={() => setSidebarOpen(false)} className="flex items-center space-x-3 p-4 rounded-2xl hover:bg-slate-800 transition duration-200 group">
              <LayoutDashboard size={20} className="text-slate-500 group-hover:text-blue-400" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Dashboard</span>
            </Link>
            <Link to="/sales" onClick={() => setSidebarOpen(false)} className="flex items-center space-x-3 p-4 rounded-2xl hover:bg-slate-800 transition duration-200 group">
              <Receipt size={20} className="text-slate-500 group-hover:text-emerald-400" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Ventas</span>
            </Link>
            <Link to="/platforms" onClick={() => setSidebarOpen(false)} className="flex items-center space-x-3 p-4 rounded-2xl hover:bg-slate-800 transition duration-200 group">
              <Tv size={20} className="text-slate-500 group-hover:text-purple-400" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Plataformas</span>
            </Link>
            <Link to="/distributors" onClick={() => setSidebarOpen(false)} className="flex items-center space-x-3 p-4 rounded-2xl hover:bg-slate-800 transition duration-200 group">
              <UsersIcon size={20} className="text-slate-500 group-hover:text-blue-400" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Socios</span>
            </Link>
            <Link to="/clients" onClick={() => setSidebarOpen(false)} className="flex items-center space-x-3 p-4 rounded-2xl hover:bg-slate-800 transition duration-200 group">
              <User size={20} className="text-slate-500 group-hover:text-emerald-400" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Clientes</span>
            </Link>
            <Link to="/users" onClick={() => setSidebarOpen(false)} className="flex items-center space-x-3 p-4 rounded-2xl hover:bg-slate-800 transition duration-200 group border-t border-slate-800 pt-6 mt-6">
              <UsersIcon size={20} className="text-slate-500 group-hover:text-indigo-400" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Usuarios</span>
            </Link>
          </nav>

          <div className="mt-auto border-t border-slate-800 pt-6">
            <div className="p-4 bg-slate-950/40 rounded-3xl border border-slate-800/50 mb-4">
              <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Sesión Iniciada como</p>
              <p className="text-[10px] font-bold text-white truncate max-w-full">{user.email}</p>
            </div>
            <button 
              onClick={handleLogoutClick}
              className="w-full flex items-center justify-center space-x-3 p-4 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 group"
            >
              <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-[11px] font-black uppercase tracking-widest">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen lg:ml-64">
        <header className="sticky top-0 z-[40] bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 flex items-center lg:hidden">
          <button className="text-slate-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2 ml-4">
            <ShieldCheck className="text-indigo-500" size={20} />
            <h1 className="text-lg font-black italic tracking-tighter uppercase whitespace-nowrap">Grupoxua</h1>
          </div>
        </header>
        
        <div className="flex-1 p-6 lg:p-10 overflow-auto">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/platforms" element={<ProtectedRoute><Platforms /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
            <Route path="/distributors" element={<ProtectedRoute><Distributors /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </div>
      </main>

      {/* MODAL CONFIRMACIóN LOGOUT */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="fixed inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsLogoutModalOpen(false)}></div>
           <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[40px] p-10 shadow-3xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
              <div className="flex flex-col items-center text-center">
                 <div className="w-20 h-20 bg-red-500/10 rounded-[30px] flex items-center justify-center text-red-500 mb-8 animate-pulse">
                    <LogOut size={32} />
                 </div>
                 <h3 className="text-2xl font-black italic tracking-tighter uppercase text-white mb-2">¿Cerrar Sesión?</h3>
                 <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest mb-10 leading-relaxed">
                   ¿Estás seguro que deseas salir del panel de control de Grupoxua?
                 </p>
                 
                 <div className="grid grid-cols-2 gap-4 w-full">
                    <button 
                      onClick={() => setIsLogoutModalOpen(false)}
                      className="py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={confirmLogout}
                      className="py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all"
                    >
                      Sí, Salir
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
