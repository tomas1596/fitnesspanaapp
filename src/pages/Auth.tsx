import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dumbbell } from 'lucide-react';

/* ─── Theme-aware style tokens ──────────────────────────────────────────────
   Computed once per render based on resolved theme.
   Using inline objects / string vars keeps the JSX readable.
──────────────────────────────────────────────────────────────────────────── */
function useAuthStyles(isDark: boolean) {
  const pageBg = isDark
    ? 'bg-gradient-to-b from-zinc-950 via-zinc-900 to-black'
    : 'bg-zinc-100';

  const titleColor = isDark ? 'text-white' : 'text-zinc-900';
  const subtitleColor = isDark ? 'text-white/40' : 'text-zinc-500';

  const card = isDark
    ? 'border border-white/10 bg-zinc-900/50 shadow-2xl backdrop-blur-xl'
    : 'border border-zinc-200 bg-white shadow-sm';

  const inputCls = [
    'h-14 rounded-xl text-sm transition-all duration-200',
    'focus-visible:ring-0 focus-visible:ring-offset-0',
    'focus-visible:border-primary',
    isDark
      ? 'border border-white/10 bg-white/8 text-white placeholder:text-zinc-500 caret-primary'
      : 'border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-500 caret-primary',
  ].join(' ');

  const selectTriggerCls = [
    'h-14 rounded-xl text-sm transition-all duration-200 focus:ring-0 focus:ring-offset-0',
    isDark
      ? 'border border-white/10 bg-white/8 text-white'
      : 'border border-zinc-300 bg-white text-zinc-900',
  ].join(' ');

  const selectContentCls = isDark
    ? 'border-white/10 bg-zinc-900 text-white'
    : 'border-zinc-200 bg-white text-zinc-900';

  const selectItemCls = isDark
    ? 'cursor-pointer text-white focus:bg-white/10 focus:text-white'
    : 'cursor-pointer text-zinc-900 focus:bg-zinc-100 focus:text-zinc-900';

  const toggleTextCls = isDark
    ? 'text-zinc-400 hover:text-zinc-200'
    : 'text-zinc-600 hover:text-zinc-900';

  const btnTextCls = isDark ? 'text-primary-foreground' : 'text-black';

  return {
    pageBg,
    titleColor,
    subtitleColor,
    card,
    inputCls,
    selectTriggerCls,
    selectContentCls,
    selectItemCls,
    toggleTextCls,
    btnTextCls,
  };
}

/* ─── Component ──────────────────────────────────────────────────────────── */

const Auth = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const S = useAuthStyles(isDark);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [signUpRedirectHold, setSignUpRedirectHold] = useState(false);
  const [dobInputType, setDobInputType] = useState<'text' | 'date'>('text');
  const dobRef = useRef<HTMLInputElement>(null);

  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${S.pageBg}`}>
        <Dumbbell className="h-8 w-8 animate-pulse" style={{ color: 'var(--brand-color)' }} />
      </div>
    );
  }

  if (user && !signUpRedirectHold) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    if (!isLogin) {
      if (!firstName.trim() || !lastName.trim() || !dateOfBirth || !gender) {
        setError('Completá nombre, apellido, fecha de nacimiento y género.');
        setSubmitting(false);
        return;
      }
    }

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    } else {
      setSignUpRedirectHold(true);
      const { error } = await signUp(email, password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth,
        gender,
      });
      if (error) {
        setSignUpRedirectHold(false);
        setError(error.message);
      } else {
        await new Promise((r) => setTimeout(r, 800));
        setSignUpRedirectHold(false);
        setSuccessMsg('¡Cuenta creada! Revisa tu email para confirmar.');
      }
    }

    setSubmitting(false);
  };

  return (
    <div className={`flex min-h-screen flex-col items-center justify-center px-5 py-10 ${S.pageBg}`}>

      {/* ── Logo ── */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary"
          style={{ boxShadow: isDark
            ? '0 0 32px rgba(34,197,94,0.50), 0 0 72px rgba(34,197,94,0.15)'
            : '0 0 24px rgba(34,197,94,0.35), 0 4px 16px rgba(0,0,0,0.10)',
          }}
        >
          <Dumbbell className="h-8 w-8 text-black" />
        </div>
        <h1 className={`text-2xl font-extrabold tracking-tight ${S.titleColor}`}>
          Pana Fitness
        </h1>
        <p className={`text-sm ${S.subtitleColor}`}>Tu compañero de fitness</p>
      </div>

      {/* ── Glass card ── */}
      <div className={`w-full max-w-sm rounded-3xl p-7 ${S.card}`}>
        <h2 className={`mb-6 text-lg font-bold tracking-tight ${S.titleColor}`}>
          {isLogin ? 'Iniciar Sesión' : 'Crear cuenta'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">

          {/* ── Register-only fields ── */}
          {!isLogin && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="text"
                  placeholder="Nombre"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                  className={S.inputCls}
                />
                <Input
                  type="text"
                  placeholder="Apellido"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                  className={S.inputCls}
                />
              </div>

              <Input
                ref={dobRef}
                type={dobInputType}
                placeholder="Fecha de nacimiento"
                value={dateOfBirth}
                onTouchStart={() => setDobInputType('date')}
                onFocus={() => setDobInputType('date')}
                onBlur={() => { if (!dateOfBirth) setDobInputType('text'); }}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
                className={`${S.inputCls} appearance-none overflow-hidden py-0 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-date-and-time-value]:m-0 [&::-webkit-datetime-edit]:p-0`}
              />

              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className={S.selectTriggerCls}>
                  <SelectValue placeholder="Seleccionar género" />
                </SelectTrigger>
                <SelectContent className={S.selectContentCls}>
                  <SelectItem value="male" className={S.selectItemCls}>Masculino</SelectItem>
                  <SelectItem value="female" className={S.selectItemCls}>Femenino</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}

          {/* ── Common fields ── */}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={S.inputCls}
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            className={S.inputCls}
          />

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          {successMsg && (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
              {successMsg}
            </p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className={`h-14 w-full rounded-xl text-base font-bold tracking-tight transition-all duration-300 active:scale-95 ${S.btnTextCls}`}
            style={{ boxShadow: isDark
              ? '0 0 20px rgba(34,197,94,0.40), 0 4px 20px rgba(0,0,0,0.35)'
              : '0 0 16px rgba(34,197,94,0.30), 0 4px 12px rgba(0,0,0,0.08)',
            }}
          >
            {submitting ? '…' : isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </Button>
        </form>

        {/* ── Toggle login / register ── */}
        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setSignUpRedirectHold(false);
            setError('');
            setSuccessMsg('');
          }}
          className={`mt-6 w-full text-center text-sm transition-colors duration-300 ${S.toggleTextCls}`}
        >
          {isLogin ? (
            <>¿No tienes cuenta?{' '}
              <span className="font-bold" style={{ color: 'var(--brand-color)' }}>
                Regístrate
              </span>
            </>
          ) : (
            <>¿Ya tienes cuenta?{' '}
              <span className="font-bold" style={{ color: 'var(--brand-color)' }}>
                Inicia sesión
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Auth;
