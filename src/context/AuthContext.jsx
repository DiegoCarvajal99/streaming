import { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { onSnapshot, doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userMetadata, setUserMetadata] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeMetadata = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Escuchar cambios en la metadata del usuario en tiempo real
        unsubscribeMetadata = onSnapshot(doc(db, 'users_metadata', currentUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserMetadata(data);
            
            // Si el administrador desactiva la cuenta, forzar logout
            if (data.active === false) {
              signOut(auth);
            }
          } else {
            // Si no hay metadata pero es la cuenta maestra, la creamos automáticamente
            if (currentUser.email?.toLowerCase().trim() === 'diegocarvajal302@gmail.com') {
              console.log("🛠️ Detectada cuenta maestra sin metadata. Iniciando auto-reparación...");
              const masterData = {
                name: 'Diego',
                email: currentUser.email.toLowerCase().trim(),
                active: true,
                createdAt: new Date().toISOString()
              };
              try {
                await setDoc(doc(db, 'users_metadata', currentUser.uid), masterData);
                setUserMetadata(masterData);
                console.log("✅ Metadata maestra creada con éxito para UID:", currentUser.uid);
              } catch (e) {
                console.error("❌ Fallo crítico al crear metadata maestra:", e);
              }
            } else {
              console.log("🔍 Usuario sin metadata (No es maestro):", currentUser.email);
              setUserMetadata({ active: true });
            }
          }
          setLoading(false);
        });
      } else {
        setUserMetadata(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeMetadata();
    };
  }, []);

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ user, userMetadata, loading, login, logout, resetPassword }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
