import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import Auth from "./pages/Auth";
import Workout from "./pages/Workout";
import Nutrition from "./pages/Nutrition";
import Timer from "./pages/Timer";
import Cardio from "./pages/Cardio";
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
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!user) {
      setCheckingOnboarding(false);
      setNeedsOnboarding(false);
      return;
    }

    let active = true;
    const checkProfile = async () => {
      setCheckingOnboarding(true);
      const { data } = await supabase
        .from("profiles")
        .select("display_name, age, gender, weight, height, activity_level, fitness_goal")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;
      const profile = data as {
        display_name?: string | null;
        age?: number | null;
        gender?: string | null;
        weight?: number | null;
        height?: number | null;
        activity_level?: string | null;
        fitness_goal?: string | null;
      } | null;

      const missing =
        !profile ||
        !profile.display_name ||
        !profile.age ||
        !profile.gender ||
        !profile.weight ||
        !profile.height ||
        !profile.activity_level ||
        !profile.fitness_goal;
      setNeedsOnboarding(missing);
      setCheckingOnboarding(false);
    };

    checkProfile();
    return () => { active = false; };
  }, [user]);

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
