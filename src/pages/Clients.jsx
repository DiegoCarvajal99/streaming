import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Plus, Trash2, User, Phone, Edit3, X, Search, MessageCircle } from 'lucide-react';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    contacto: ''
  });

  const fetchClients = async () => {
    try {
      const q = query(collection(db, 'clientes'), orderBy('nombre', 'asc'));
      const querySnapshot = await getDocs(q);
      setClients(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (formData.id) {
        await updateDoc(doc(db, 'clientes', formData.id), {
          nombre: formData.nombre,
          contacto: formData.contacto
        });
      } else {
        await addDoc(collection(db, 'clientes'), {
          nombre: formData.nombre,
          contacto: formData.contacto,
          fechaRegistro: new Date().toISOString()
        });
      }
      setFormData({ nombre: '', contacto: '' });
      setIsModalOpen(false);
      fetchClients();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Eliminar cliente?')) {
      try {
        await deleteDoc(doc(db, 'clientes', id));
        fetchClients();
      } catch (error) { console.error(error); }
    }
  };

  const filteredClients = clients.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.contacto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-5xl font-black tracking-tighter text-white italic uppercase bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">Clientes</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Base de datos de Clientes Finales</p>
        </div>
        <button 
          onClick={() => { setFormData({ nombre: '', contacto: '' }); setIsModalOpen(true); }}
          className="px-8 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[30px] font-black text-xs uppercase tracking-widest transition-all shadow-2xl flex items-center gap-3 active:scale-95"
        >
          <Plus size={20} strokeWidth={3} /> Nuevo Cliente
        </button>
      </div>

      <div className="relative group max-w-md">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={20} />
        <input 
          type="text" 
          placeholder="BUSCAR CLIENTE..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="w-full bg-slate-900/40 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-white text-[10px] uppercase font-black outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-600" 
        />
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden lg:block bg-slate-900/40 border border-slate-800 rounded-[50px] overflow-hidden backdrop-blur-xl shadow-3xl">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left lg:min-w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-10 py-8 text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Cliente</th>
                <th className="px-10 py-8 text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">WhatsApp / Contacto</th>
                <th className="px-10 py-8 text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredClients.map((client) => (
                <tr key={client.id} className="group hover:bg-slate-800/30 transition-all duration-300">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                        <User size={28} />
                      </div>
                      <span className="text-lg font-black text-white italic uppercase tracking-tighter">{client.nombre}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-3">
                      <Phone size={14} className="text-slate-500" />
                      <span className="text-slate-300 font-bold">{client.contacto}</span>
                      <a 
                        href={`https://wa.me/${client.contacto.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-white transition-all ml-2"
                      >
                        <MessageCircle size={14} />
                      </a>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => { setFormData(client); setIsModalOpen(true); }} className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all" title="Editar"><Edit3 size={18}/></button>
                      <button onClick={() => handleDelete(client.id)} className="p-3 bg-red-500/10 text-red-500/60 hover:bg-red-600 hover:text-white rounded-xl transition-all"><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE PREMIUM CARDS */}
      <div className="lg:hidden space-y-4">
        {filteredClients.map((client) => (
          <div key={client.id} className="group relative bg-slate-900/60 backdrop-blur-xl p-6 rounded-[32px] border border-slate-800/80 shadow-2xl shadow-black/20 transition-all active:scale-[0.98]">
             <div className="flex items-center gap-4 mb-6">
                <div className="shrink-0 w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                   <User size={28} />
                </div>
                <div className="min-w-0">
                   <h4 className="text-sm font-black text-white italic truncate uppercase tracking-tight mb-1">{client.nombre}</h4>
                   <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                      <Phone size={10} />
                      {client.contacto}
                   </div>
                </div>
             </div>

             <div className="flex items-center justify-between pt-4 border-t border-slate-800/60">
                <a 
                  href={`https://wa.me/${client.contacto.replace(/\D/g, '')}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 font-black text-[9px] uppercase tracking-widest shadow-lg shadow-emerald-500/5 active:scale-95 transition-all"
                >
                   <MessageCircle size={14} /> WhatsApp
                </a>

                <div className="flex items-center gap-1.5 bg-slate-950/30 p-1.5 rounded-2xl border border-slate-800/30">
                   <button onClick={() => { setFormData(client); setIsModalOpen(true); }} className="p-3 bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-700"><Edit3 size={16}/></button>
                   <button onClick={() => handleDelete(client.id)} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={16}/></button>
                </div>
             </div>
          </div>
        ))}
        {filteredClients.length === 0 && !loading && (
          <div className="p-20 text-center space-y-4">
             <div className="inline-block p-6 bg-slate-800 rounded-full text-slate-600 animate-pulse"><User size={40} /></div>
             <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">No hay clientes registrados.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md"></div>
          <div className="relative w-full max-w-lg bg-slate-900 rounded-[50px] border border-slate-800 shadow-2xl animate-in zoom-in p-10 space-y-10">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-3xl font-black italic uppercase text-white tracking-tighter">{formData.id ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Información de contacto del cliente</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-800 rounded-2xl transition-all text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Nombre Completo</label>
                <input required placeholder="Ej: Juan Pérez" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-6 py-5 text-white font-black text-xs" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">WhatsApp / Teléfono</label>
                <input required placeholder="+57 300 000 0000" value={formData.contacto} onChange={e => setFormData({...formData, contacto: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-6 py-5 text-white font-black text-xs" />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-slate-800 text-slate-400 font-black rounded-3xl uppercase text-[10px] tracking-widest">Cancelar</button>
                <button type="submit" className="flex-1 py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-3xl uppercase text-[10px] tracking-widest shadow-xl">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
