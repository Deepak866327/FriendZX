import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { pageVariants } from '@/utils/animations';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { SocketProvider } from '@/context/SocketContext';
import { UserProvider } from '@/context/UserContext';
import { LocationProvider } from '@/context/LocationContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ChatProvider } from '@/context/ChatContext';
import { CallProvider } from '@/context/CallContext';
import { BluetoothProvider } from '@/context/BluetoothContext';
import { ChallengeProvider } from '@/context/ChallengeContext';
import { CallOverlay } from '@/components/Call/CallOverlay';
import { ChallengeResultBanner } from '@/components/Challenge/ChallengeResultBanner';
import { ErrorBoundary } from '@/components/Common/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { ExplorePage } from '@/pages/ExplorePage';
import { NearbyPage } from '@/pages/NearbyPage';
import { MessagesPage } from '@/pages/MessagesPage';
import { FeedPage } from '@/pages/FeedPage';
import { Header } from '@/components/Common/Header';
import { BottomActionBar } from '@/components/Common/BottomActionBar';
import './App.css';

/* Redirect authenticated users away from the landing page to the app */
const RootRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />;
};

const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="loading"><div className="loading-spinner"></div></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SocketProvider>
      <NotificationProvider>
        <ChatProvider>
          <CallProvider>
            <BluetoothProvider>
            <ChallengeProvider>
            <UserProvider>
              <LocationProvider>
                {/* Shared background blobs — fixed, persist across page transitions */}
                <div className="fx-bg-blob-1" />
                <div className="fx-bg-blob-2" />
                <div className="fx-bg-blob-3" />
                <Header />
                <div className="main-content">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={location.pathname}
                      variants={pageVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      style={{ minHeight: 0 }}
                    >
                      <Outlet />
                    </motion.div>
                  </AnimatePresence>
                </div>
                <CallOverlay />
                <ChallengeResultBanner />
                <BottomActionBar />
              </LocationProvider>
            </UserProvider>
            </ChallengeProvider>
            </BluetoothProvider>
          </CallProvider>
        </ChatProvider>
      </NotificationProvider>
    </SocketProvider>
  );
};

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
            <Route path="/profile" element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />
            <Route path="/explore" element={<ErrorBoundary><ExplorePage /></ErrorBoundary>} />
            <Route path="/nearby" element={<ErrorBoundary><NearbyPage /></ErrorBoundary>} />
            <Route path="/messages" element={<ErrorBoundary><MessagesPage /></ErrorBoundary>} />
            <Route path="/feed" element={<ErrorBoundary><FeedPage /></ErrorBoundary>} />
          </Route>
          <Route path="/" element={<RootRoute />} />
        </Routes>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
