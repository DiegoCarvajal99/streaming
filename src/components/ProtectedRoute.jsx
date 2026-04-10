import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { user, userMetadata, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Si no está logueado O la metadata dice que está inactivo, fuera.
  if (!user || userMetadata?.active === false) {
    return <Navigate to="/login" />;
  }

  return children;
};

export default ProtectedRoute;
