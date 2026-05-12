import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NRC_GREEN = '#39FF14';

export default function VerifiedAccount() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  // Pequeña demora para que la animación de entrada sea perceptible
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 80);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pb-12 pt-10">
      <div
        className={`flex w-full max-w-sm flex-col items-center gap-8 transition-all duration-700 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
        }`}
      >
        {/* Logo */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
          <Dumbbell className="h-7 w-7 text-primary-foreground" />
        </div>

        {/* Icono de éxito */}
        <div className="relative flex items-center justify-center">
          {/* Halo animado */}
          <span
            className="absolute h-28 w-28 animate-ping rounded-full opacity-20"
            style={{ backgroundColor: NRC_GREEN }}
          />
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full"
            style={{ backgroundColor: `${NRC_GREEN}22`, boxShadow: `0 0 32px ${NRC_GREEN}55` }}
          >
            <CheckCircle2
              className="h-12 w-12"
              style={{ color: NRC_GREEN }}
              strokeWidth={1.75}
            />
          </div>
        </div>

        {/* Texto */}
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            ¡Cuenta confirmada!
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Bienvenido a <span className="font-semibold text-foreground">Pana Fitness</span>.
            Tu período de prueba gratuito de&nbsp;
            <span className="font-semibold" style={{ color: NRC_GREEN }}>
              7 días
            </span>{' '}
            ya comenzó.
          </p>
        </div>

        {/* CTA */}
        <Button
          className="h-14 w-full rounded-2xl text-base font-bold tracking-wide"
          style={{ background: NRC_GREEN, color: '#0b0f14' }}
          onClick={() => navigate('/', { replace: true })}
        >
          Comenzar a entrenar
        </Button>
      </div>
    </div>
  );
}
