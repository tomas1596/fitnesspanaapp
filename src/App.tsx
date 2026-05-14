import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { useSubscriptionStatus, SubscriptionProvider } from "@/hooks/useSubscriptionStatus";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import Auth from "./pages/Auth";
import Workout from "./pages/Workout";
import Nutrition from "./pages/Nutrition";
import Timer from "./pages/Timer";
import Cardio from "./pages/Cardio";
import ActivityDetail from "./pages/ActivityDetail";
import Profile from "./pages/Profile";
import AdminPanel from "./pages/AdminPanel";
import Paywall from "./pages/Paywall";
import VerifiedAccount from "./pages/VerifiedAccount";
import Terminos from "./pages/Terminos";
import NotFound from "./pages/NotFound";
import { applyBrandTheme } from "@/lib/brandTheme";

const queryClient = new QueryClient();

/**
 * Componente sin UI: lee `profiles.theme` del usuario actual y aplica
 * las CSS custom properties de marca en el elemento raíz del documento.
 * Se resetea al rosa neón por defecto cuando el usuario cierra sesión.
 */
const BrandThemeApplier = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      applyBrandTheme('default');
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('theme')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      const theme = (data as { theme?: string } | null)?.theme;
      applyBrandTheme(theme === 'pink' ? 'pink' : 'default');
    })();
    return () => { active = false; };
  }, [user]);

  return null;
};

// ─────────────────────────────────────────────────────────────────────────

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

const ADMIN_EMAIL = 'thomzonlyskills@gmail.com';

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAdmin, isAdminLoading } = useAuth();
  if (loading || isAdminLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin || user.email !== ADMIN_EMAIL) return <Navigate to="/" replace />;
  return <>{children}</>;
};

/** Bloquea rutas cuando la suscripción expiró; redirige a /paywall. */
const SubscriptionGuard = ({ children }: { children: React.ReactNode }) => {
  const sub = useSubscriptionStatus();
  if (sub.status === 'loading') return null;
  if (sub.status === 'expired') return <Navigate to="/paywall" replace />;
  return <>{children}</>;
};

/** Ruta protegida por auth + suscripción activa. */
const AppRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <SubscriptionGuard>{children}</SubscriptionGuard>
  </ProtectedRoute>
);

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
        <Route path="/" element={<AppRoute><Workout /></AppRoute>} />
        <Route path="/timer" element={<AppRoute><Timer /></AppRoute>} />
        <Route path="/cardio" element={<AppRoute><Cardio /></AppRoute>} />
        <Route path="/actividad/:id" element={<AppRoute><ActivityDetail /></AppRoute>} />
        <Route path="/nutrition" element={<AppRoute><Nutrition /></AppRoute>} />
        <Route path="/profile" element={<AppRoute><Profile /></AppRoute>} />
        {/* /paywall y /verificado: sólo requieren auth, sin subscription guard */}
        <Route path="/paywall" element={<ProtectedRoute><Paywall /></ProtectedRoute>} />
        <Route path="/verificado" element={<ProtectedRoute><VerifiedAccount /></ProtectedRoute>} />
        <Route path="/terminos" element={<ProtectedRoute><Terminos /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {/* Ocultar BottomNav en paywall y en la pantalla de bienvenida post-verificación */}
      {user && !['/paywall', '/verificado', '/terminos'].includes(location.pathname) && <BottomNav />}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <SubscriptionProvider>
            <BrowserRouter>
              <BrandThemeApplier />
              <ServiceWorkerCardioBridge />
              <AppRoutes />
            </BrowserRouter>
          </SubscriptionProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
