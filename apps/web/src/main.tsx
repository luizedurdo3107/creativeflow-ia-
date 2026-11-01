import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { AdminPage } from './pages/Admin';
import { ApprovalsPage } from './pages/Approvals';
import { CampaignPage } from './pages/Campaign';
import { CampaignsPage } from './pages/Campaigns';
import { CatalogPage } from './pages/Catalog';
import { DashboardPage } from './pages/Dashboard';
import { LoginPage } from './pages/Login';
import { BrandCatalogPage } from './pages/BrandCatalog';
import { BrandCampaignsPage } from './pages/BrandCampaigns';
import { NewCampaignPage } from './pages/NewCampaign';
import { SettingsPage } from './pages/Settings';
import { StudioPage } from './pages/Studio';

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 5_000 } } });

function Legacy({children,to}:{children:React.ReactNode;to:string}){const {config}=useAuth();return config?.appMode==='demo'?<>{children}</>:<Navigate to={to} replace/>;}

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/entrar" replace />;
  return <Layout />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/entrar" element={<LoginPage />} />
              <Route element={<Protected />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/campanhas" element={<Legacy to="/marcas/campanhas"><CampaignsPage /></Legacy>} />
                <Route path="/campanhas/nova" element={<Legacy to="/marcas/campanhas"><NewCampaignPage /></Legacy>} />
                <Route path="/campanhas/:id" element={<Legacy to="/marcas/campanhas"><CampaignPage /></Legacy>} />
                <Route path="/pecas/:id" element={<Legacy to="/marcas/campanhas"><StudioPage /></Legacy>} />
                <Route path="/marcas/catalogo" element={<BrandCatalogPage />} />
                <Route path="/marcas/campanhas" element={<BrandCampaignsPage />} />
                <Route path="/aprovacoes" element={<ApprovalsPage />} />
                <Route path="/catalogo" element={<Legacy to="/marcas/catalogo"><CatalogPage /></Legacy>} />
                <Route path="/configuracoes" element={<SettingsPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
