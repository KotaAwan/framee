import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DynamicForm from '../../../components/dynamic/DynamicForm';
import withAuth from '../../../components/hoc/withAuth';

function DocumentFormPage() {
  const router = useRouter();
  const { doctype, name } = router.query;

  if (!doctype || !name) return null;

  return (
    <>
      <Head>
        <title>{name === 'new' ? `New ${doctype}` : `${name} - ${doctype}`} | Framee</title>
      </Head>
      <DynamicForm doctype={doctype} recordId={name} />
    </>
  );
}

export default withAuth(DocumentFormPage);
