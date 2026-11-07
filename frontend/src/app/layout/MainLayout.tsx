import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TopNavbar } from './TopNavbar';
import { Sidebar } from './Sidebar';

export const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#070b14] text-slate-100">
      {/* Top Operations Navbar */}
      <TopNavbar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-[#070b14] via-[#090e1c] to-[#070b14] p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
