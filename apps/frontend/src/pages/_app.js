import React, { useEffect, useState } from 'react';
import '../styles/globals.css';
import AppLayout from '../components/layout/AppLayout';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  // Public routes that don't need AppLayout
  const publicRoutes = ['/login', '/forgot-password', '/reset-password'];
  const isPublicRoute = publicRoutes.includes(router.pathname);

  useEffect(() => {
    // Avoid synchronous setState in effect
    setTimeout(() => {
      setMounted(true);
    }, 0);
    // Setup default theme
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  if (!mounted) return null; // Prevent hydration mismatch

  if (isPublicRoute) {
    return <Component {...pageProps} />;
  }

  return (
    <AppLayout>
      <Component {...pageProps} />
    </AppLayout>
  );
}
