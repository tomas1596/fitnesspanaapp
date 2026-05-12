import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Clock, Copy, CheckCircle2, LogOut } from 'lucide-react';

const MP_ALIAS = 'tomaspanadeiro.mp';

const STEPS = [
  {
    n: 1,
    title: 'Transferí a Mercado Pago',
    desc: null,
  },
  {
    n: 2,
    title: 'Avisanos por el canal de soporte',
    desc: 'Enviá el comprobante para que podamos verificarlo.',
  },
  {
    n: 3,
    title: 'Activación manual en pocas horas',
    desc: 'Tu cuenta se habilita una vez confirmado el pago.',
  },
];

export default function Paywall() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const subscription = useSubscriptionStatus();
  const { toast } = useToast();

  // Auto-redirect if subscription was activated while on this screen
  useEffect(() => {
    if (subscription.status === 'premium' || subscription.status === 'trial') {
      navigate('/', { replace: true });
    }
  }, [subscription.status, navigate]);

  const copyAlias = async () => {
    try {
      await navigator.clipboard.writeText(MP_ALIAS);
      toast({ title: '¡Copiado!', description: 'Alias guardado en el portapapeles.' });
    } catch {
      toast({ title: 'Copiá el alias manualmente', description: MP_ALIAS });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pb-12 pt-10">
      <div className="w-full max-w-md space-y-8">

        {/* Hero */}
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-10 w-10 text-primary" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Prueba finalizada
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Tus 7 días gratuitos han concluido.
            <br />
            Activá tu suscripción para seguir usando Pana Fitness.
          </p>
        </div>

        {/* Steps card */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-0">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cómo activar tu cuenta
          </p>

          {STEPS.map((step, idx) => (
            <div key={step.n}>
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {step.n}
                </span>
                <div className="flex-1 min-w-0 pb-4">
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  {step.n === 1 && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="flex-1 truncate rounded-lg bg-emerald-500/10 px-3 py-1.5 font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        {MP_ALIAS}
                      </span>
                      <button
                        type="button"
                        onClick={copyAlias}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground active:scale-95"
                        aria-label="Copiar alias"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {step.desc && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
                  )}
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div className="mb-4 ml-3 border-l border-dashed border-border" style={{ height: 0 }} />
              )}
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <Button
            className="h-12 w-full rounded-2xl text-base font-semibold"
            onClick={() => navigate('/', { replace: true })}
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            Ya pagué · Verificar acceso
          </Button>
          <Button
            variant="ghost"
            className="h-10 w-full rounded-2xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => void signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
