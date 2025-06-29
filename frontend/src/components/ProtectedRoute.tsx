import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireLicense?: boolean;
    requireActiveLicense?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requireLicense = false,
    requireActiveLicense = false
}) => {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();

    // Show loading state while checking authentication
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // If license is required but user has no license, redirect to license activation
    if (requireLicense && !user?.licenseId) {
        return <Navigate to="/activate-license" state={{ from: location }} replace />;
    }

    // If active license is required, check license status
    if (requireActiveLicense) {
        // This would typically involve checking the license status from the auth context
        // For now, we'll just check if the user has a license ID
        if (!user?.licenseId) {
            return <Navigate to="/activate-license" state={{ from: location }} replace />;
        }
    }

    // If all checks pass, render the protected content
    return <>{children}</>;
};

export default ProtectedRoute; 