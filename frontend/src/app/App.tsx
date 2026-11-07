import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layout/MainLayout';
import { CommandCenterView } from '../features/simulation/CommandCenterView';
import { DataCentersView } from '../features/datacenters/DataCentersView';
import { SimulationsView } from '../features/simulation/SimulationsView';
import { MonitoringView } from '../features/simulation/MonitoringView';
import { IncidentsView } from '../features/simulation/IncidentsView';
import { SettingsView } from '../features/simulation/SettingsView';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<CommandCenterView />} />
          <Route path="datacenters" element={<DataCentersView />} />
          <Route path="simulations" element={<SimulationsView />} />
          <Route path="monitoring" element={<MonitoringView />} />
          <Route path="incidents" element={<IncidentsView />} />
          <Route path="settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
