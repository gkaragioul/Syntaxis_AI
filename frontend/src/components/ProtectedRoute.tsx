import React from 'react';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
}) => {
    // Free access mode - no authentication required
    return <>{children}</>;
};

export default ProtectedRoute; 