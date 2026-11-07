import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from './useAuthStore';
import { Server, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isInitializing } = useAuthStore();
  const location = useLocation();

  // Prevent authentication-state flicker during initial session loading from storage
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center text-center p-4 select-none">
        <div className="relative mb-5">
          <div className="w-14 h-14 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_30px_-5px_rgba(6,182,212,0.4)]">
            <Server className="w-7 h-7" />
          </div>
          <Loader2 className="w-5 h-5 text-cyan-300 animate-spin absolute -bottom-1 -right-1" />
        </div>
        <div className="text-xs font-mono tracking-widest text-cyan-300 uppercase font-semibold">
          Restoring Operator Session...
        </div>
        <p className="text-[11px] font-mono text-slate-400 mt-1">DATAVERSE SECURITY GATEWAY</p>
      </div>
    );
  }

  // If not authenticated, redirect to /login and preserve current location in state
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated, render protected content
  return children ? <>{children}</> : <Outlet />;
};
