import React from 'react';
import withAuth from '../components/hoc/withAuth';

function Dashboard() {
  return (
    <div className="bg-(--color-surface) rounded-lg shadow-sm border border-(--color-border) p-6">
      <h1 className="text-2xl font-bold mb-4">Welcome to Framee Dashboard</h1>
      <p className="text-(--color-muted) mb-6">
        This is a placeholder dashboard. The Layout (Sidebar and Header) is wrapping this content.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 rounded-lg bg-(--color-background) border border-(--color-border)">
          <h3 className="font-medium mb-2">Total Users</h3>
          <p className="text-3xl font-bold text-(--color-primary)">12</p>
        </div>
        <div className="p-4 rounded-lg bg-(--color-background) border border-(--color-border)">
          <h3 className="font-medium mb-2">Active Sessions</h3>
          <p className="text-3xl font-bold text-(--color-primary)">4</p>
        </div>
        <div className="p-4 rounded-lg bg-(--color-background) border border-(--color-border)">
          <h3 className="font-medium mb-2">System Load</h3>
          <p className="text-3xl font-bold text-(--color-primary)">2%</p>
        </div>
      </div>
    </div>
  );
}

export default withAuth(Dashboard);
