import { useState, useEffect } from 'react';
import { collection, onSnapshot, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { db, firebaseConfig } from '../firebase';
import { 
  UserPlus, Search, X, Mail, Shield, 
  Key, User as UserIcon, AlertCircle, CheckCircle2,
  Trash2, MoreVertical, Edit3, ShieldOff, Check, Send
} from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    active: true
  });

  const [status, setStatus] = useState({ type: '', message: '' });

  // Escuchar la colección de usuarios en tiempo real
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'users_metadata'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name || '',
        email: user.email || '',
        password: '', 
        active: user.active !== undefined ? user.active : true
      });
    } else {
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', active: true });
    }
    setStatus({ type: '', message: '' });
    setIsModalOpen(true);
  };

  const handleResetPasswordEmail = async () => {
    if (!formData.email) return;
    setStatus({ type: 'loading', message: 'Enviando correo...' });
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, formData.email);
      setStatus({ type: 'success', message: '📧 Correo de restablecimiento enviado.' });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Fallo al enviar: ' + err.code });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: 'loading', message: editingUser ? 'Actualizando...' : 'Creando usuario...' });
    
    try {
      if (editingUser) {
        // Actualizar usuario existente (Metadata)
        await updateDoc(doc(db, 'users_metadata', editingUser.id), {
          name: formData.name,
          email: formData.email, // Actualizar email en metadata para referencia
          active: formData.active
        });
        setStatus({ type: 'success', message: 'Usuario actualizado correctamente.' });
      } else {
        // Crear nuevo usuario
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          formData.email, 
          formData.password
        );
        
        await setDoc(doc(db, 'users_metadata', userCredential.user.uid), {
          name: formData.name,
          email: formData.email,
          active: true,
          createdAt: new Date().toISOString(),
          createdBy: 'Admin'
        });

        await signOut(secondaryAuth);
        setStatus({ type: 'success', message: 'Usuario creado y registrado.' });
      }

      setTimeout(() => {
        setIsModalOpen(false);
      }, 1500);

    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Error: ' + err.code });
    }
  };

  const handleToggleStatus = async (user) => {
    if (user.email === 'diegocarvajal302@gmail.com') return;
    try {
      const newStatus = user.active === false ? true : false;
      await updateDoc(doc(db, 'users_metadata', user.id), { active: newStatus });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      setStatus({ type: 'loading', message: 'Eliminando...' });
      await deleteDoc(doc(db, 'users_metadata', userToDelete.id));
      console.log("✅ Usuario eliminado.");
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Error: ' + err.code });
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white uppercase italic">Colaboradores</h2>
          <p className="text-slate-500 mt-1 font-medium italic">Administra el acceso del personal al sistema corporativo.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-8 rounded-3xl shadow-xl transition-all active:scale-95 uppercase text-xs tracking-widest"
        >
          <UserPlus size={22} /> Nuevo Colaborador
        </button>
      </div>

      <div className="relative group max-w-xl">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={20} />
        <input 
          type="text" 
          placeholder="Buscar colaborador..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-14 pr-6 py-4 text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map(u => (
          <div key={u.id} className={`group bg-slate-900/40 p-8 rounded-[40px] border transition-all duration-500 relative overflow-hidden flex flex-col justify-between ${u.active === false ? 'border-red-500/20 opacity-60 grayscale shadow-inner' : u.email === 'diegocarvajal302@gmail.com' ? 'border-amber-500/40 shadow-amber-500/10' : 'border-slate-800/60 hover:border-indigo-500/30 shadow-2xl shadow-black/20'}`}>
            <div className="absolute top-0 right-0 p-6 flex gap-2">
               <button onClick={() => handleOpenModal(u)} className="p-3 bg-slate-800 hover:bg-indigo-500 text-slate-400 hover:text-white rounded-2xl transition-all shadow-lg opacity-0 group-hover:opacity-100"><Edit3 size={18}/></button>
               {u.email !== 'diegocarvajal302@gmail.com' && (
                 <button onClick={() => { setUserToDelete(u); setIsDeleteModalOpen(true); }} className="p-3 bg-slate-800 hover:bg-red-500 text-slate-400 hover:text-white rounded-2xl transition-all shadow-lg opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
               )}
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center gap-5">
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center border transition-all duration-500 ${u.active === false ? 'bg-red-500/10 text-red-500 border-red-500/20' : u.email === 'diegocarvajal302@gmail.com' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                  {u.active === false ? <ShieldOff size={32} /> : u.email === 'diegocarvajal302@gmail.com' ? <Shield size={32} /> : <UserIcon size={32} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-white text-xl truncate uppercase tracking-tighter">{u.name}</h3>
                    {u.email === 'diegocarvajal302@gmail.com' && (
                      <span className="flex items-center gap-1 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-500/20">Master</span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs font-bold truncate">{u.email}</p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${u.active === false ? 'bg-red-500/10 text-red-500 border-red-500/20' : u.email === 'diegocarvajal302@gmail.com' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                  {u.active === false ? <ShieldOff size={12} /> : <Shield size={12} />}
                  <span>{u.active === false ? 'Inactivo' : u.email === 'diegocarvajal302@gmail.com' ? 'Master Admin' : 'Activo'}</span>
                </div>
                <div className="flex items-center gap-3">
                   <p className="text-[10px] font-black text-slate-700 uppercase">Estado</p>
                   <button 
                    disabled={u.email === 'diegocarvajal302@gmail.com'}
                    onClick={() => handleToggleStatus(u)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-all duration-500 ${u.active === false ? 'bg-slate-700' : 'bg-emerald-600 shadow-lg shadow-emerald-500/20'} ${u.email === 'diegocarvajal302@gmail.com' ? 'opacity-20 cursor-not-allowed grayscale' : 'cursor-pointer'}`}
                   >
                     <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-500 ${u.active === false ? 'translate-x-0' : 'translate-x-6'}`}></div>
                   </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm"></div>
          <div className="relative w-full max-w-lg bg-slate-900 rounded-[50px] border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="flex items-center justify-between p-10 border-b border-slate-800 bg-slate-900/50">
              <div className="space-y-1">
                <h3 className="text-3xl font-black italic tracking-tighter uppercase text-white">
                  {editingUser ? 'Ficha de Colaborador' : 'Nuevo Colaborador'}
                </h3>
                {editingUser && <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">ID: {editingUser.id}</p>}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-800 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {status.message && (
                <div className={`p-4 rounded-2xl flex items-center gap-4 animate-in fade-in zoom-in duration-300 ${
                  status.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-500' : 
                  status.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' :
                  'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                }`}>
                  {status.type === 'error' ? <AlertCircle size={20}/> : status.type === 'success' ? <CheckCircle2 size={20}/> : <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>}
                  <p className="text-xs font-black leading-tight uppercase tracking-tight">{status.message}</p>
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Nombre Completo</label>
                  <div className="relative group">
                    <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400" size={18} />
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Juan Pérez" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-14 py-5 text-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner" />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Email {editingUser ? '(Metadata)' : '(Login)'}</label>
                  <div className="relative group text-white">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400" size={18} />
                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="correo@ejemplo.com" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-14 py-5 text-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner" />
                  </div>
                  {editingUser && <p className="text-[9px] text-slate-600 font-bold ml-2 italic">* El cambio aquí es informativo. Para cambiar el login, crea un nuevo perfil.</p>}
                </div>

                {editingUser ? (
                  <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-3xl space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-3 text-indigo-400">
                      <Key size={18} />
                      <h4 className="text-[10px] font-black uppercase tracking-widest">Gestión de Acceso</h4>
                    </div>
                    <p className="text-slate-500 text-[10px] leading-relaxed">¿El colaborador olvidó su clave? Envía un link oficial para que establezca una nueva de forma segura.</p>
                    <button 
                      type="button" 
                      onClick={handleResetPasswordEmail}
                      disabled={status.type === 'loading'}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-indigo-500/20 shadow-lg"
                    >
                      <Send size={16} /> Enviar Link de Reinicio
                    </button>
                    <p className="text-center text-[9px] font-black uppercase tracking-widest text-slate-700">Grupoxua Digital Engineering</p>
                  </div>
                ) : (
                  <div className="space-y-3 animate-in slide-in-from-top-4 duration-500">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Contraseña Inicial</label>
                    <div className="relative group">
                      <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400" size={18} />
                      <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Mínimo 6 caracteres" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-14 py-5 text-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-6 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black rounded-3xl transition-all uppercase text-[10px] tracking-widest active:scale-95">Descartar</button>
                <button type="submit" disabled={status.type === 'loading'} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-3xl shadow-xl transition-all uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 active:scale-95">
                  <Check size={18} />
                  {status.type === 'loading' ? 'Guardando...' : editingUser ? 'Actualizar Ficha' : 'Generar Acceso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ELIMINACIÓN PERSONALIZADO */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm animate-in fade-in" onClick={() => setIsDeleteModalOpen(false)}></div>
          <div className="relative w-full max-w-sm bg-slate-900 rounded-[40px] border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-300 p-10 space-y-8 text-center">
            <div className="inline-flex items-center justify-center p-5 bg-red-500/10 rounded-3xl border border-red-500/20 text-red-500">
              <Trash2 size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black italic tracking-tighter uppercase text-white">¿Estás seguro?</h3>
              <p className="text-slate-500 text-xs font-bold leading-relaxed">
                Estás a punto de eliminar a <span className="text-white">"{userToDelete?.name}"</span>. Esta acción no se puede deshacer de forma sencilla.
              </p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black rounded-3xl transition-all uppercase text-[10px] tracking-widest active:scale-95"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteUser}
                className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-3xl shadow-xl shadow-red-600/10 transition-all uppercase text-[10px] tracking-widest active:scale-95"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
