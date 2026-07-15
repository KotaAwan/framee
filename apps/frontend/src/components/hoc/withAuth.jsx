import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../../store/auth.store';

export default function withAuth(WrappedComponent) {
  return function ProtectedRoute(props) {
    const router = useRouter();
    const { isAuthenticated, isLocked } = useAuthStore();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
      setIsClient(true);
      if (!isAuthenticated && router.pathname !== '/login') {
        router.replace('/login');
      } else if (isLocked && router.pathname !== '/locked') {
        // We can add a locked screen later
        // router.replace('/locked');
      }
    }, [isAuthenticated, isLocked, router]);

    // Don't render anything during SSR to prevent hydration mismatch for auth state
    if (!isClient) return null;
    
    if (!isAuthenticated) return null;

    return <WrappedComponent {...props} />;
  };
}
