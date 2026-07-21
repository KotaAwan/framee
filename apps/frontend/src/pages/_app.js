import React from 'react';
import '../styles/globals.css';
import AppLayout from '../components/layout/AppLayout';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  
  // Public routes that don't need AppLayout
  const publicRoutes = ['/login', '/forgot-password', '/reset-password'];
  const isPublicRoute = publicRoutes.includes(router.pathname);


  if (isPublicRoute) {
    return <Component {...pageProps} />;
  }

  return (
    <AppLayout>
      <Component {...pageProps} />
    </AppLayout>
  );
}
