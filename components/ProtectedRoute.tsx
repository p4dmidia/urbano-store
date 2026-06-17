import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: 'client' | 'admin';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
    const { user, profile, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#C5A880]"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to={requiredRole === 'admin' ? '/admin/login' : '/login'} replace />;
    }

    // Wait for profile to load if we have a user
    if (!profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#C5A880]"></div>
            </div>
        );
    }

    if (requiredRole && profile.role !== requiredRole) {
        // Admins are allowed to access client routes (e.g. for body profiles or personal storefront usage)
        if (profile.role === 'admin' && requiredRole === 'client') {
            return <>{children}</>;
        }
        // Safe redirects on role mismatch
        if (profile.role === 'admin') {
            return <Navigate to="/admin/dashboard" replace />;
        }
        return <Navigate to="/shop" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
