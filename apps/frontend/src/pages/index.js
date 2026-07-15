import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import apiClient from '@/lib/api.client';
import { LayoutDashboard, Database, Settings, Box } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export default function WorkspaceDashboard() {
  const router = useRouter();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const res = await apiClient.get('/api/v1/workspace');
        if (res.data?.success) {
          setModules(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load workspace:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkspace();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="text-gray-500 animate-pulse">Loading Workspace...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Workspace | Framee</title>
      </Head>

      <div className="space-y-8 pb-12">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Workspace
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Welcome back! Here are your modules and shortcuts.
            </p>
          </div>
        </div>

        {modules.length === 0 ? (
          <Card className="p-12 text-center text-slate-500">
            No modules or shortcuts found. Please configure them in the System module.
          </Card>
        ) : (
          <div className="space-y-10">
            {modules.map((mod) => (
              <section key={mod.id} className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 border-b pb-2 flex items-center gap-2">
                  <Box size={20} className="text-slate-400" /> {mod.name}
                </h2>
                
                {(!mod.shortcuts || mod.shortcuts.length === 0) ? (
                  <p className="text-sm text-slate-500 italic">No shortcuts available for this module.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {mod.shortcuts.map(shortcut => {
                      const href = shortcut.type === 'DocType' ? `/doctype/${shortcut.target}` : shortcut.target;
                      
                      return (
                        <Card 
                          key={shortcut.id}
                          className="hover:shadow-md transition-shadow cursor-pointer hover:border-blue-200 dark:hover:border-blue-800 group"
                          onClick={() => router.push(href)}
                        >
                          <div className="p-4 flex items-center gap-3">
                            <div className="p-2 bg-slate-50 group-hover:bg-blue-50 text-slate-500 group-hover:text-blue-600 rounded-md transition-colors dark:bg-slate-800 dark:group-hover:bg-blue-900/40">
                              <Database size={20} />
                            </div>
                            <div>
                              <div className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {shortcut.label}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {shortcut.type}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
