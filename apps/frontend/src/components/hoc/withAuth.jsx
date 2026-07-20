import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../../store/auth.store';

export default function withAuth(WrappedComponent) {
  return function ProtectedRoute(props) {
    const router = useRouter();
    const { isAuthenticated, isLocked } = useAuthStore();
    const [hydrated, setHydrated] = React.useState(false);

    React.useEffect(() => {
      setHydrated(true);
    }, []);

    React.useEffect(() => {
      if (hydrated && !isAuthenticated && router.pathname !== '/login') {
        router.replace('/login');
      }
    }, [hydrated, isAuthenticated, isLocked, router]);

    // Show loading spinner while hydrating or redirecting unauthenticated users
    if (!hydrated || !isAuthenticated) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading...</div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}
