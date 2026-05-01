import { useState } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MainLayout } from './layouts/MainLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { DashboardHome } from './pages/user/DashboardHome';
import { LoginPage } from './pages/LoginPage';
import { WorkspacesPage } from './pages/user/WorkspacesPage';
import { EditorPage } from './pages/user/EditorPage';
import { HistoryPage } from './pages/user/HistoryPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { FeedbackReview } from './pages/admin/FeedbackReview';
import { UserManagement } from './pages/admin/UserManagement';
import { ConnectionsManagement } from './pages/admin/ConnectionsManagement';
import { EvaluationPage } from './pages/admin/EvaluationPage';
import { SchemaEditor } from './pages/user/TableEditor';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type AdminPage = 'overview' | 'users' | 'feedback' | 'connections' | 'evaluation' | 'settings';

function LoginRoute() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    if (location.pathname === '/login') {
      return <Navigate to={user?.role === 'admin' ? '/admin' : '/overview'} replace />;
    }
    return null;
  }

  return <LoginPage />;
}

function AppContent() {
  const [currentAdminPage, setCurrentAdminPage] = useState<AdminPage>('overview');
  const { isAuthenticated, isLoading, logout, user } = useAuth();

  const ProtectedUserLayout = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      );
    }
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    return (
      <MainLayout onLogout={logout}>
        <Outlet />
      </MainLayout>
    );
  };

  const ProtectedAdminLayout = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      );
    }
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    // Check if user is admin
    if (user?.role !== 'admin') {
      return <Navigate to="/overview" replace />;
    }
    return (
      <AdminLayout 
        currentPage={currentAdminPage} 
        onNavigate={(page) => setCurrentAdminPage(page as AdminPage)}
        onLogout={logout}
      >
        {renderAdminPage()}
      </AdminLayout>
    );
  };

  const renderAdminPage = () => {
    switch (currentAdminPage) {
      case 'overview':
        return <AdminDashboard />;
      case 'users':
        return <UserManagement />;
      case 'feedback':
        return <FeedbackReview />;
      case 'connections':
        return <ConnectionsManagement />;
      case 'evaluation':
        return <EvaluationPage />;
      case 'settings':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                System Config
              </h2>
              <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">Coming soon...</p>
            </div>
          </div>
        );
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      
      {/* Admin Routes */}
      <Route path="/admin/*" element={<ProtectedAdminLayout />} />
      
      {/* User Routes */}
      <Route element={<ProtectedUserLayout />}>
        <Route path="/overview" element={<DashboardHome />} />
        <Route path="/workspaces" element={<WorkspacesPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark mb-2">Settings</h2>
              <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">Coming soon...</p>
            </div>
          </div>
        } />
      </Route>

      {/* Editor Route - Outside MainLayout for full-screen experience */}
      <Route path="/editor/:workspaceId/:conversationId?" element={
        isLoading ? (
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : isAuthenticated ? (
          <EditorPage />
        ) : (
          <Navigate to="/login" replace />
        )
      } />



      {/* Schema Editor Route - For editing schema of any workspace (real or simulation) */}
      <Route path="/schema-editor/:workspaceId/:conversationId?" element={
        isLoading ? (
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : isAuthenticated ? (
          <SchemaEditor />
        ) : (
          <Navigate to="/login" replace />
        )
      } />

      <Route path="/" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
