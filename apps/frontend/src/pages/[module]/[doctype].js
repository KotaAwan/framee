import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DynamicList from '../../components/dynamic/DynamicList';
import withAuth from '../../components/hoc/withAuth';
import apiClient from '../../lib/api.client';

function DocTypeListPage() {
  const router = useRouter();
  const { module, doctype } = router.query;
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!doctype) return;
    let isMounted = true;
    const checkSingle = async () => {
      try {
        const res = await apiClient.get(`/api/v1/meta/doctype/${doctype}`);
        if (res.data?.data?.is_single && isMounted) {
          // If it's a single doctype, redirect immediately to the document form
          router.replace(`/${module}/${doctype}/${doctype}`);
        } else if (isMounted) {
          setChecking(false);
        }
      } catch (err) {
        console.error('Failed to check doctype meta', err);
        if (isMounted) setChecking(false);
      }
    };
    
    checkSingle();
    return () => { isMounted = false; };
    // eslint-disable-next-line
  }, [module, doctype]);

  if (!doctype || checking) return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-primary)"></div>
    </div>
  );

  return (
    <>
      <Head>
        <title>{doctype} | Framee</title>
      </Head>
      <DynamicList doctype={doctype} module={module} />
    </>
  );
}

export default withAuth(DocTypeListPage);
