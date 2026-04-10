import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, AlertCircle, ShieldCheck, Trash2, Zap } from 'lucide-react';
import { db, auth as firebaseAuth } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found') setError('El usuario no existe.');
      else if (err.code === 'auth/wrong-password') setError('Contraseña incorrecta.');
      else if (err.code === 'auth/invalid-credential') setError('Credenciales no válidas.');
      else setError(`Error (${err.code}): Inténtalo de nuevo.`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) { alert("Ingresa tu correo primero."); return; }
    try {
      setLoading(true);
      await sendPasswordResetEmail(firebaseAuth, email);
      alert("✅ Correo enviado.");
    } catch (err) { alert("Error: " + err.message); }
    finally { setLoading(false); }
  };

  // HERRAMIENTA 1: Borrar toda la metadata de la DB
  const handleClearDatabase = async (e) => {
    e?.preventDefault();
    if (!confirm("⚠️ ¿Estás seguro? Esto borrará TODOS los usuarios de la base de datos Firestore (metadata).")) return;
    try {
      setLoading(true);
      console.log("💥 Iniciando limpieza de base de datos...");
      const querySnapshot = await getDocs(collection(db, 'users_metadata'));
      const deletePromises = querySnapshot.docs.map(d => deleteDoc(doc(db, 'users_metadata', d.id)));
      await Promise.all(deletePromises);
      alert("✅ Base de datos de metadatos limpiada.");
    } catch (err) {
      console.error(err);
      alert("Error al limpiar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // HERRAMIENTA 2: Crear/Reparar Admin y auto-llenar campos
  const handleMasterRebuild = async (e) => {
    e?.preventDefault();
    const MASTER_EMAIL = 'diegocarvajal302@gmail.com';
    const MASTER_PASS = 'DAch162600..';

    // Auto-llenar campos inmediatamente para feedback visual
    setEmail(MASTER_EMAIL);
    setPassword(MASTER_PASS);

    try {
      setLoading(true);
      setError('');
      console.log("🛠️ Iniciando Rebuild Maestro...");
      
      // 1. Intentar entrar para obtener el UID (si ya existe en Auth)
      let uid = null;
      try {
        console.log("🔑 Intentando login inicial...");
        const userCredential = await login(MASTER_EMAIL, MASTER_PASS);
        uid = userCredential.user.uid;
        console.log("✅ Usuario ya existe en Auth. UID:", uid);
      } catch (authErr) {
        console.log("⚠️ Fallo login inicial:", authErr.code);
        // Manejar tanto 'user-not-found' como 'invalid-credential' (por protección de enumeración)
        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
          console.log("🆕 Intentando crear usuario nuevo...");
          try {
            const userCredential = await createUserWithEmailAndPassword(firebaseAuth, MASTER_EMAIL, MASTER_PASS);
            uid = userCredential.user.uid;
            console.log("✅ Usuario creado con éxito. UID:", uid);
          } catch (createErr) {
            // Si el error es que ya existe, volvemos a intentar pero con login
            if (createErr.code === 'auth/email-already-in-use') {
              console.log("🔄 Email ya en uso, intentando forzar login...");
              const userCredential = await login(MASTER_EMAIL, MASTER_PASS);
              uid = userCredential.user.uid;
            } else {
              throw createErr;
            }
          }
        } else {
          throw authErr;
        }
      }

      // 3. Con el UID, forzamos la creación/actualización de metadata
      if (uid) {
        console.log("📝 Sincronizando metadata en Firestore...");
        await setDoc(doc(db, 'users_metadata', uid), {
          name: 'Administrador Maestro',
          email: MASTER_EMAIL,
          active: true,
          createdAt: new Date().toISOString()
        }, { merge: true });
        console.log("✨ Sincronización completa.");
      }

      alert("✅ Maestro Re-instalado y Metadata Sincronizada. Ya puedes entrar.");
    } catch (err) {
      console.error("❌ Error CRÍTICO en Rebuild:", err);
      alert("Error en Rebuild: " + (err.code || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/40 backdrop-blur-2xl p-10 rounded-[50px] border border-slate-800 shadow-2xl space-y-8 animate-in zoom-in duration-500">
          
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center p-4 bg-indigo-500/10 rounded-3xl border border-indigo-500/20 mb-4">
              <ShieldCheck className="text-indigo-400" size={32} />
            </div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white tracking-widest">Grupoxua Auth</h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Acceso a Ingeniería Digital</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Usuario</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl pl-14 pr-6 py-5 text-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-700" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center ml-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-none">Contraseña</label>
                <button type="button" onClick={handleResetPassword} className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-tighter">¿Problemas con la clave?</button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input required type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl pl-14 pr-16 py-5 text-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-700" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in">
                <AlertCircle className="text-red-500 shrink-0" size={18} />
                <p className="text-xs font-bold text-red-500">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-3xl shadow-xl shadow-indigo-600/10 transition-all active:scale-95 uppercase text-[10px] tracking-[0.2em]">
              {loading ? "Procesando..." : "Entrar al Sistema"}
            </button>
          </form>

          <p className="text-center text-[9px] font-black uppercase tracking-widest text-slate-700">Grupoxua Digital Engineering</p>
        </div>
      </div>
    </div>
  );
}
