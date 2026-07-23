import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DynamicList from '../../components/dynamic/DynamicList';
import DynamicForm from '../../components/dynamic/DynamicForm';
import withAuth from '../../components/hoc/withAuth';
import apiClient from '../../lib/api.client';

function DocTypeListPage() {
  const router = useRouter();
  const { module, doctype } = router.query;
  const [checking, setChecking] = useState(true);
  const [isSingle, setIsSingle] = useState(false);
  const [singleRecordId, setSingleRecordId] = useState(null);

  useEffect(() => {
    if (!doctype) return;
    let isMounted = true;
    const checkSingle = async () => {
      try {
        const res = await apiClient.get(`/api/v1/meta/doctype/${doctype}`);
        if (res.data?.data?.is_single && isMounted) {
          // If it's a single doctype, read from database limit 1 to get ID
          try {
            const listRes = await apiClient.get(`/api/v1/doc/${doctype}?limit=1`);
            const records = Array.isArray(listRes.data?.data) ? listRes.data.data : (listRes.data?.data?.records || []);
            if (records.length > 0) {
              setSingleRecordId(records[0].id || records[0].name);
            }
          } catch (e) {
            console.error('Failed to fetch single doctype record', e);
          } finally {
            if (isMounted) {
              setIsSingle(true);
              setChecking(false);
            }
          }
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
      {isSingle ? (
        <DynamicForm doctype={doctype} recordId={singleRecordId} />
      ) : (
        <DynamicList doctype={doctype} module={module} />
      )}
    </>
  );
}

export default withAuth(DocTypeListPage);
