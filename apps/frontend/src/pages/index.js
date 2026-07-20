import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import withAuth from '@/components/hoc/withAuth';

function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
      <div className="text-gray-500 animate-pulse">Redirecting...</div>
    </div>
  );
}

export default withAuth(IndexPage);
