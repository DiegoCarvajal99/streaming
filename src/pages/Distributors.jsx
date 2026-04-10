import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Plus, Trash2, Users, ExternalLink, Activity, Edit3, CheckCircle2, XCircle, MessageCircle, X } from 'lucide-react';

export default function Distributors() {
  const [distribuidors, setDistribuidors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    whatsappLink: '',
    activo: true
  });

  const fetchDistributors = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'distribuidores'));
      setDistribuidors(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching distributors:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDistributors(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (formData.id) {
        await updateDoc(doc(db, 'distribuidores', formData.id), {
          nombre: formData.nombre,
          whatsappLink: formData.whatsappLink,
          activo: formData.activo
        });
      } else {
        await addDoc(collection(db, 'distribuidores'), formData);
      }
      setFormData({ nombre: '', whatsappLink: '', activo: true });
      setIsModalOpen(false);
      fetchDistributors();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (dist) => {
    try {
      await updateDoc(doc(db, 'distribuidores', dist.id), { activo: !dist.activo });
      fetchDistributors();
    } catch (error) { console.error(error); }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Eliminar distribuidor?')) {
      try {
        await deleteDoc(doc(db, 'distribuidores', id));
        fetchDistributors();
      } catch (error) { console.error(error); }
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-5xl font-black tracking-tighter text-white italic uppercase bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Distribuidores</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Gestión de Socios y Grupos de WhatsApp</p>
        </div>
        <button 
          onClick={() => { setFormData({ nombre: '', whatsappLink: '', activo: true }); setIsModalOpen(true); }}
          className="px-8 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[30px] font-black text-xs uppercase tracking-widest transition-all shadow-2xl flex items-center gap-3 active:scale-95"
        >
          <Plus size={20} strokeWidth={3} /> Nuevo Socio
        </button>
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden lg:block bg-slate-900/40 border border-slate-800 rounded-[50px] overflow-hidden backdrop-blur-xl shadow-3xl">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left lg:min-w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-10 py-8 text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Distribuidor / Grupo</th>
                <th className="px-10 py-8 text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Grupo de WhatsApp</th>
                <th className="px-10 py-8 text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Estado</th>
                <th className="px-10 py-8 text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {distribuidors.map((dist) => (
                <tr key={dist.id} className="group hover:bg-slate-800/30 transition-all duration-300">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                        <Users size={28} />
                      </div>
                      <span className="text-lg font-black text-white italic uppercase tracking-tighter">{dist.nombre}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    {dist.whatsappLink ? (
                      <a href={dist.whatsappLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-400 hover:text-white transition-colors text-xs font-bold leading-none">
                        <ExternalLink size={14} /> Ver Grupo
                      </a>
                    ) : (
                      <span className="text-slate-600 text-xs italic">Sin grupo</span>
                    )}
                  </td>
                  <td className="px-10 py-8">
                    <button onClick={() => handleToggleStatus(dist)} className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${dist.activo ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                      <Activity size={14} />
                      <span className="text-[10px] font-black uppercase">{dist.activo ? 'Activo' : 'Inactivo'}</span>
                    </button>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => { setFormData(dist); setIsModalOpen(true); }} className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all" title="Editar"><Edit3 size={18}/></button>
                      <button onClick={() => handleDelete(dist.id)} className="p-3 bg-red-500/10 text-red-500/60 hover:bg-red-600 hover:text-white rounded-xl transition-all"><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE PREMIUM CARDS (NANO BENTO) */}
      <div className="lg:hidden space-y-4">
        {distribuidors.map((dist) => (
          <div key={dist.id} className="group relative bg-slate-900/60 backdrop-blur-xl p-6 rounded-[32px] border border-slate-800/80 shadow-2xl shadow-black/20 transition-all active:scale-[0.98]">
             {/* HEADER: SOCIO IDENTITY */}
             <div className="flex items-center gap-4 mb-6">
                <div className="shrink-0 w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                   <Users size={28} />
                </div>
                <div className="min-w-0">
                   <h4 className="text-sm font-black text-white italic truncate uppercase tracking-tight mb-1">{dist.nombre}</h4>
                   <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border tracking-widest ${
                      dist.activo 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                   }`}>
                      {dist.activo ? 'SOCIO ACTIVO' : 'INACTIVO'}
                   </span>
                </div>
             </div>

             {/* DATA GRID: WHATSAPP LINK */}
             <div className="grid grid-cols-1 gap-3 mb-6">
                <div className="bg-slate-950/40 border border-slate-800/40 p-4 rounded-2xl">
                   <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2">Canal de Comunicación</p>
                   {dist.whatsappLink ? (
                      <a href={dist.whatsappLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-400 font-black text-[11px] uppercase tracking-tighter hover:text-white transition-colors">
                         <MessageCircle size={14} /> Acceder al Grupo de WhatsApp
                      </a>
                   ) : (
                      <span className="text-slate-500 text-[10px] italic">No se ha configurado un link</span>
                   )}
                </div>
             </div>

             {/* ACTIONS FOOTER */}
             <div className="flex items-center justify-between pt-4 border-t border-slate-800/60">
                <button onClick={() => handleToggleStatus(dist)} className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${dist.activo ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                   <Activity size={14} />
                   <span className="text-[9px] font-black uppercase">{dist.activo ? 'Desactivar' : 'Activar'}</span>
                </button>

                <div className="flex items-center gap-1.5 bg-slate-950/30 p-1.5 rounded-2xl border border-slate-800/30">
                   <button onClick={() => { setFormData(dist); setIsModalOpen(true); }} className="p-3 bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-700"><Edit3 size={16}/></button>
                   <button onClick={() => handleDelete(dist.id)} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={16}/></button>
                </div>
             </div>
          </div>
        ))}
        {distribuidors.length === 0 && !loading && (
          <div className="p-20 text-center space-y-4">
             <div className="inline-block p-6 bg-slate-800 rounded-full text-slate-600 animate-pulse"><Users size={40} /></div>
             <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">No hay distribuidores registrados.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md"></div>
          <div className="relative w-full max-w-lg bg-slate-900 rounded-[50px] border border-slate-800 shadow-2xl animate-in zoom-in p-10 space-y-10">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-3xl font-black italic uppercase text-white tracking-tighter">{formData.id ? 'Editar Socio' : 'Nuevo Distribuidor'}</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Configura la información del grupo</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-800 rounded-2xl transition-all text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Nombre del Distribuidor / Grupo</label>
                <input required placeholder="Ej: Pantallas Sebastian" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-6 py-5 text-white font-black text-xs" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Grupo de WhatsApp (Link)</label>
                <input required placeholder="https://chat.whatsapp.com/..." value={formData.whatsappLink} onChange={e => setFormData({...formData, whatsappLink: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-6 py-5 text-white font-black text-xs" />
              </div>

              <div className="flex items-center justify-between p-6 bg-slate-800/30 rounded-3xl border border-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${formData.activo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {formData.activo ? <CheckCircle2 size={20}/> : <XCircle size={20}/>}
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-white tracking-widest leading-none">Estado del Socio</h4>
                    <p className="text-[8px] font-bold text-slate-500 uppercase mt-1 tracking-tighter">{formData.activo ? 'El socio aparecerá en las ventas' : 'Oculto de las opciones de venta'}</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, activo: !formData.activo})}
                  className={`w-14 h-8 rounded-full relative transition-colors ${formData.activo ? 'bg-indigo-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${formData.activo ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-slate-800 text-slate-400 font-black rounded-3xl uppercase text-[10px] tracking-widest">Cancelar</button>
                <button type="submit" className="flex-1 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-3xl uppercase text-[10px] tracking-widest shadow-xl">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
