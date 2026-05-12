import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import BottomNav from "@/components/BottomNav";
import Auth from "./pages/Auth";
import Workout from "./pages/Workout";
import Nutrition from "./pages/Nutrition";
import Timer from "./pages/Timer";
import Cardio from "./pages/Cardio";
import ActivityDetail from "./pages/ActivityDetail";
import Profile from "./pages/Profile";
import AdminPanel from "./pages/AdminPanel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Enfoca la app en /cardio al pulsar la notificación de carrera (mensaje desde el Service Worker). */
const ServiceWorkerCardioBridge = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const onSwMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "OPEN_CARDIO") {
        navigate("/cardio");
      }
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onSwMessage);
  }, [navigate]);
  return null;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  const isAuth = location.pathname === "/auth";
  if (!user && !isAuth) return <Navigate to="/auth" replace />;

  return (
    <>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/onboarding" element={<Navigate to="/" replace />} />
        <Route path="/" element={<ProtectedRoute><Workout /></ProtectedRoute>} />
        <Route path="/timer" element={<ProtectedRoute><Timer /></ProtectedRoute>} />
        <Route path="/cardio" element={<ProtectedRoute><Cardio /></ProtectedRoute>} />
        <Route path="/actividad/:id" element={<ProtectedRoute><ActivityDetail /></ProtectedRoute>} />
        <Route path="/nutrition" element={<ProtectedRoute><Nutrition /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {user && <BottomNav />}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <BrowserRouter>
            <ServiceWorkerCardioBridge />
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
