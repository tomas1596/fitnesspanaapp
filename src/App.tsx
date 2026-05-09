import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
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
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, loading, checkingOnboarding, needsOnboarding } = useAuth();
  const location = useLocation();

  if (loading || checkingOnboarding) return null;

  const isAuth = location.pathname === "/auth";
  const isOnboarding = location.pathname === "/onboarding";
  if (user && needsOnboarding && !isOnboarding) return <Navigate to="/onboarding" replace />;
  if (user && !needsOnboarding && isOnboarding) return <Navigate to="/" replace />;
  if (!user && !isAuth) return <Navigate to="/auth" replace />;

  return (
    <>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><Workout /></ProtectedRoute>} />
        <Route path="/timer" element={<ProtectedRoute><Timer /></ProtectedRoute>} />
        <Route path="/cardio" element={<ProtectedRoute><Cardio /></ProtectedRoute>} />
        <Route path="/actividad/:id" element={<ProtectedRoute><ActivityDetail /></ProtectedRoute>} />
        <Route path="/nutrition" element={<ProtectedRoute><Nutrition /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {user && !needsOnboarding && <BottomNav />}
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
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
