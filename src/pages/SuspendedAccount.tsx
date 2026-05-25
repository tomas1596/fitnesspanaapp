import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Ban, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useAccountStatus } from '@/hooks/useAccountStatus';

export default function SuspendedAccount() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const accountStatus = useAccountStatus();

  useEffect(() => {
    if (accountStatus.status === 'loading') return;
    if (accountStatus.status === 'active') {
      navigate('/', { replace: true });
    }
  }, [accountStatus.status, navigate]);

  if (accountStatus.status === 'loading') {
    return null;
  }

  const isBanned = accountStatus.status === 'banned';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pb-12 pt-10">
      <div className="w-full max-w-md space-y-8 text-center">
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
            isBanned ? 'bg-red-500/10' : 'bg-amber-500/10'
          }`}
        >
          {isBanned ? (
            <Ban className="h-10 w-10 text-red-500" strokeWidth={1.75} aria-hidden />
          ) : (
            <AlertTriangle className="h-10 w-10 text-amber-500" strokeWidth={1.75} aria-hidden />
          )}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {isBanned ? 'Acceso denegado' : 'Cuenta suspendida'}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isBanned
              ? 'Acceso denegado de forma permanente. Si creés que es un error, contactá al soporte de Pana Fitness.'
              : 'Tu cuenta fue suspendida temporalmente. Contactá a tu coach o al administrador de tu gimnasio para reactivar el acceso.'}
          </p>
        </div>

        <Button
          variant="ghost"
          className="h-12 w-full rounded-2xl text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => void signOut().then(() => navigate('/', { replace: true }))}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
