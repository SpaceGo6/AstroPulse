import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { DataProvider } from './data/DataContext.jsx';
import Layout from './components/Layout.jsx';
import Today from './pages/Today.jsx';
import CheckIn from './pages/CheckIn.jsx';
import Remeasure from './pages/Remeasure.jsx';
import Trends from './pages/Trends.jsx';
import Forecast from './pages/Forecast.jsx';
import BodyMap from './pages/BodyMap.jsx';
import Alert from './pages/Alert.jsx';
import Audit from './pages/Audit.jsx';

// HashRouter: works from any static host or straight from disk, no server routing needed.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DataProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Today />} />
            <Route path="checkin" element={<CheckIn />} />
            <Route path="remeasure" element={<Remeasure />} />
            <Route path="trends/:id" element={<Trends />} />
            <Route path="forecast" element={<Forecast />} />
            <Route path="body" element={<BodyMap />} />
            <Route path="audit" element={<Audit />} />
          </Route>
          <Route path="alert" element={<Alert />} />
        </Routes>
      </HashRouter>
    </DataProvider>
  </StrictMode>,
);
