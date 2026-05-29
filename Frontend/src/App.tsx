// -- third-party imports

import {
  Routes,
  Route,
} from 'react-router-dom';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

import {
  ToastContainer,
  Bounce,
} from 'react-toastify';

// -- local imports

import {
  AuthProvider,
} from '@/context/AuthContext';

import {
  UserCacheProvider,
} from '@/context/UserCacheContext';

import {
  WebSocketClientMessengerProvider,
} from '@/context/WebSocketClientMessengerProvider';

import Dashboard from '@/pages/Dashboard';
import Whiteboard from '@/pages/Whiteboard';
import UserAuth from '@/pages/UserAuth';
import AccountSettings from '@/pages/AccountSettings';
import ProtectedRoute from '@/components/ProtectedRoute';
import PublicWhiteboardRoute from '@/components/PublicWhiteboardRoute';
import AboutUs from './pages/AboutUs';

const App = () => {
  const queryClient = new QueryClient();

  return (
    <AuthProvider>
      <UserCacheProvider>
        <QueryClientProvider client={queryClient}>
          <Routes>
            {/** Public Routes **/}
            <Route path="/login" element={<UserAuth action="login"/>} />
            <Route path="/signup" element={<UserAuth action="signup"/>} />
            <Route path="/aboutUs" element={<AboutUs />} />

            {/** Protected Routes **/}
            <Route path="/" element={
              <ProtectedRoute fallback="/login">
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute fallback="/login">
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/account" element={
              <ProtectedRoute fallback="/login">
                <AccountSettings />
              </ProtectedRoute>
            } />
            <Route path="/whiteboard/:whiteboard_id" element={
              <PublicWhiteboardRoute>
                <WebSocketClientMessengerProvider>
                  <Whiteboard />
                </WebSocketClientMessengerProvider>
              </PublicWhiteboardRoute>
            } />
          </Routes>

          {/** Misc. overlays and modals **/}
          <>
            {/** Toast allows us to display styled popup alerts **/}
            <ToastContainer
              position="top-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick={false}
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
              transition={Bounce}
            />
          </>
        </QueryClientProvider>
      </UserCacheProvider>
    </AuthProvider>
  );
};

export default App
