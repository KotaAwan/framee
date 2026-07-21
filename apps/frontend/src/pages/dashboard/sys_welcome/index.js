import React from 'react';
import Head from 'next/head';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Activity, Users, FileText, Settings } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function WelcomeDashboard() {
  const { t } = useTranslation();

  const metrics = [
    { label: t('dashboard.active_users', 'Active Users'), value: '124', icon: <Users size={24} className="text-blue-500" /> },
    { label: t('dashboard.documents', 'Documents'), value: '1,042', icon: <FileText size={24} className="text-green-500" /> },
    { label: t('dashboard.system_health', 'System Health'), value: '98%', icon: <Activity size={24} className="text-red-500" /> },
    { label: t('dashboard.settings', 'Configured Settings'), value: '34', icon: <Settings size={24} className="text-orange-500" /> }
  ];

  return (
    <AppLayout>
      <Head>
        <title>{t('dashboard.welcome', 'Welcome Dashboard')} | Framee</title>
      </Head>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-(--color-text)">
            {t('dashboard.welcome_title', 'Welcome to Framee')}
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, i) => (
            <Card key={i} className="p-4 flex items-center justify-between border border-(--color-border) bg-(--color-surface)">
              <div>
                <p className="text-sm font-medium text-(--color-muted) mb-1">{metric.label}</p>
                <h3 className="text-2xl font-bold text-(--color-text)">{metric.value}</h3>
              </div>
              <div className="p-3 bg-(--color-surface-hover) rounded-full">
                {metric.icon}
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card className="p-6 border border-(--color-border) bg-(--color-surface)">
            <h3 className="font-semibold text-(--color-text) mb-4">Recent Activity</h3>
            <div className="text-sm text-(--color-muted) flex items-center justify-center h-40">
              No recent activity to show.
            </div>
          </Card>
          
          <Card className="p-6 border border-(--color-border) bg-(--color-surface)">
            <h3 className="font-semibold text-(--color-text) mb-4">Quick Links</h3>
            <div className="space-y-2">
              <a href="/system/sys_user" className="block p-3 hover:bg-(--color-surface-hover) rounded-md text-sm text-(--color-primary) font-medium transition-colors">
                Manage Users &rarr;
              </a>
              <a href="/system/sys_role" className="block p-3 hover:bg-(--color-surface-hover) rounded-md text-sm text-(--color-primary) font-medium transition-colors">
                Manage Roles &rarr;
              </a>
              <a href="/system/sys_doctype" className="block p-3 hover:bg-(--color-surface-hover) rounded-md text-sm text-(--color-primary) font-medium transition-colors">
                Configure Doctypes &rarr;
              </a>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
