import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  PlusCircle, Search, X, ChevronDown, 
  Layers, CreditCard, Clock, Image as ImageIcon, Settings2, Edit3, AlertCircle, TrendingUp
} from 'lucide-react';

export default function Platforms() {
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', message: '', icon: null, color: ''
  });

  const [filterType, setFilterType] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');

  const [formData, setFormData] = useState({
    nombre: '', vigenciaDias: '', precioCompra: '', precioVenta: '', imagenUrl: '', tipo: '', activa: true
  });

  const formatDisplayPrice = (num) => {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return '';
    return num.toString().replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseNumber = (str) => {
    if (!str) return 0;
    return Number(str.toString().replace(/\./g, ""));
  };

  const fetchPlatforms = async () => {
    const querySnapshot = await getDocs(collection(db, 'plataformas'));
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort alphabetically by name
    data.sort((a, b) => a.nombre.localeCompare(b.nombre));
    setPlatforms(data);
  };

  useEffect(() => { fetchPlatforms(); }, []);

  const handleOpenModal = (platform = null) => {
    if (platform) {
      setEditingPlatform(platform);
      setFormData({
        nombre: platform.nombre, vigenciaDias: platform.vigenciaDias,
        precioCompra: formatNumber(platform.precioCompra), precioVenta: formatNumber(platform.precioVenta),
        imagenUrl: platform.imagenUrl || '', tipo: platform.tipo || '', activa: platform.activa !== undefined ? platform.activa : true
      });
    } else {
      setEditingPlatform(null);
      setFormData({ nombre: '', vigenciaDias: '', precioCompra: '', precioVenta: '', imagenUrl: '', tipo: '', activa: true });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const handleSubmitPrompt = (e) => {
    e.preventDefault();
    if (!formData.tipo) return;
    if (editingPlatform) {
      setConfirmModal({
        isOpen: true, title: 'Confirmar Edición',
        message: '¿Estás seguro de editar esta plataforma? Los cambios se aplicarán inmediatamente.',
        icon: <Edit3 size={40} className="text-indigo-500" />, color: 'indigo'
      });
    } else { executeSave(); }
  };

  const executeSave = async () => {
    setLoading(true);
    setConfirmModal({ ...confirmModal, isOpen: false });
    try {
      const platformData = {
        nombre: formData.nombre, vigenciaDias: Number(formData.vigenciaDias),
        precioCompra: parseNumber(formData.precioCompra), precioVenta: parseNumber(formData.precioVenta),
        imagenUrl: formData.imagenUrl || 'https://via.placeholder.com/400x225?text=No+Logo',
        tipo: formData.tipo, activa: formData.activa
      };
      if (editingPlatform) { await updateDoc(doc(db, 'plataformas', editingPlatform.id), platformData); }
      else { await addDoc(collection(db, 'plataformas'), platformData); }
      handleCloseModal();
      fetchPlatforms();
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const filteredPlatforms = platforms.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'Todos' || p.tipo === filterType;
    const matchesStatus = filterStatus === 'Todos' || (filterStatus === 'Activas' ? p.activa !== false : p.activa === false);
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white uppercase">Plataformas</h2>
          <p className="text-slate-500 mt-1 font-medium italic">Gestión de inventario y segmentación de servicios.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-8 rounded-3xl shadow-xl transition-all active:scale-95 uppercase text-xs tracking-widest">
          <PlusCircle size={22} /> Nueva Plataforma
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={20} />
          <input type="text" placeholder="Buscar por nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-14 pr-6 py-4 text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
        </div>
        <div className="flex gap-4">
          <div className="relative min-w-[160px]">
             <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-white text-[10px] font-black uppercase appearance-none cursor-pointer pr-10 focus:ring-2 focus:ring-indigo-500/10"><option value="Todos">Segmentos</option><option value="Final">Cliente Final</option><option value="Distribuidor">Distribuidor</option></select>
             <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
          <div className="relative min-w-[160px]">
             <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-white text-[10px] font-black uppercase appearance-none cursor-pointer pr-10 focus:ring-2 focus:ring-indigo-500/10"><option value="Todos">Estados</option><option value="Activas">Activas</option><option value="Inactivas">Inactivas</option></select>
             <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-8">
        {filteredPlatforms.map(platform => (
          <div key={platform.id} className={`group bg-slate-900/80 rounded-[40px] border border-slate-800 overflow-hidden hover:border-indigo-500/40 transition-all duration-500 flex flex-col ${!platform.activa ? 'opacity-40 grayscale' : ''}`}>
            <div className="relative h-44">
              <img src={platform.imagenUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" onError={(e) => e.target.src = 'https://via.placeholder.com/400x225?text=' + platform.nombre} />
              <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-white/10 backdrop-blur-md shadow-xl ${platform.tipo === 'Distribuidor' ? 'bg-blue-600/80 text-white' : 'bg-purple-600/80 text-white'}`}>{platform.tipo}</span>
              </div>
            </div>
            <div className="p-8 flex-1 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="text-xl font-black text-white truncate group-hover:text-indigo-400 transition-colors uppercase tracking-tighter">{platform.nombre}</h3>
                <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Duración</p>
                    <div className="flex items-center gap-1.5 text-slate-300 font-bold"><Clock size={12}/><span className="text-xs">{platform.vigenciaDias} días</span></div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Venta</p>
                    <p className="font-black text-emerald-400 text-xl tracking-tighter">${formatDisplayPrice(platform.precioVenta)}</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleOpenModal(platform)} 
                className="w-full flex items-center justify-center gap-2 py-4 bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all font-black text-[10px] uppercase tracking-[0.2em] shadow-lg group/btn active:scale-95 border border-slate-700/50 hover:border-transparent"
              >
                <Edit3 size={14} className="group-hover/btn:scale-110 transition-transform duration-500" />
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm"></div>
          <div className="relative w-full max-w-lg bg-slate-900 rounded-[40px] border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-300 my-auto max-h-[90vh] flex flex-col font-sans">
            <div className="flex items-center justify-between p-8 border-b border-slate-800 shrink-0">
              <h3 className="text-2xl font-black tracking-tight uppercase">{editingPlatform ? 'Editar Plataforma' : 'Nueva Plataforma'}</h3>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-800 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmitPrompt} className="p-8 space-y-8 overflow-y-auto scrollbar-hide">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Nombre</label>
                  <input required placeholder="Netflix" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-white font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Tipo</label>
                  <div className="relative">
                    <select required value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-white font-bold appearance-none cursor-pointer">
                      <option value="" disabled>SELECCIONAR...</option>
                      <option value="Final">Cliente Final</option>
                      <option value="Distribuidor">Distribuidor</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">URL Imagen</label>
                <div className="relative">
                  <ImageIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                  <input type="url" placeholder="https://ejemplo.com/logo.png" value={formData.imagenUrl} onChange={e => setFormData({...formData, imagenUrl: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-12 pr-5 py-4 text-white font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Vigencia</label>
                  <input required type="number" placeholder="30" value={formData.vigenciaDias} onChange={e => setFormData({...formData, vigenciaDias: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-white font-bold focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Estado</label>
                  <div className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-2xl h-[58px]">
                    <span className={`text-[10px] font-black uppercase ${formData.activa ? 'text-emerald-400' : 'text-slate-500'}`}>{formData.activa ? 'ACTIVA' : 'INACTIVA'}</span>
                    <button type="button" onClick={() => setFormData({...formData, activa: !formData.activa})} className={`w-12 h-6 flex items-center rounded-full p-1 transition-all ${formData.activa ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all ${formData.activa ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Precio Compra</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 font-bold">$</span>
                    <input required type="text" placeholder="15.000" value={formData.precioCompra} onChange={e => setFormData({...formData, precioCompra: formatNumber(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-10 pr-5 py-4 text-white font-bold transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Precio Venta</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 font-bold">$</span>
                    <input required type="text" placeholder="25.000" value={formData.precioVenta} onChange={e => setFormData({...formData, precioVenta: formatNumber(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-10 pr-5 py-4 text-white font-bold transition-all" />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 shrink-0 mt-auto">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black rounded-2xl transition-all uppercase tracking-widest text-[10px]">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest text-[10px]">
                  {loading ? '...' : (editingPlatform ? 'Guardar' : 'Registrar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans">
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md animate-in fade-in"></div>
          <div className="relative w-full max-w-md bg-slate-900 rounded-[40px] border border-slate-800 p-10 shadow-3xl text-center space-y-8 animate-in zoom-in-95 duration-300 my-auto">
            <div className="flex flex-col items-center gap-6">
              <div className={`p-8 rounded-3xl ${confirmModal.color === 'red' ? 'bg-red-500/10 text-red-500' : 'bg-indigo-500/10 text-indigo-500'}`}>{confirmModal.icon}</div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase">{confirmModal.title}</h3>
                <p className="text-slate-500 font-medium px-4">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex gap-4 pt-4">
               <button onClick={() => setConfirmModal({...confirmModal, isOpen: false})} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl transition-all text-xs uppercase tracking-widest">Volver</button>
               <button onClick={executeSave} disabled={loading} className={`flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all text-xs uppercase tracking-widest`}>{loading ? '...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
