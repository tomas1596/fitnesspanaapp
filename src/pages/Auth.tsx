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
import { cn } from '@/lib/utils';

const DOB_RANGE_ERROR = 'Debes tener entre 10 y 100 años para usar Pana Fitness';
const DOB_REQUIRED_ERROR = 'Seleccioná tu fecha de nacimiento.';
const EMAIL_FORMAT_ERROR =
  'Ingresá un email válido (ej.: nombre@servicio.com o contacto@empresa.com.ar).';

function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function birthdateBounds() {
  const now = new Date();
  const maxDob = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
  const minDob = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
  return { minStr: toYmdLocal(minDob), maxStr: toYmdLocal(maxDob), minDob, maxDob };
}

function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

/** Fecha de nacimiento dentro de [minDob, maxDob] inclusive (solo componente calendario). */
function isDobInRange(ymd: string, minDob: Date, maxDob: Date): boolean {
  const parsed = parseYmdLocal(ymd);
  if (!parsed) return false;
  const tMid = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0).getTime();
  const minT = new Date(minDob.getFullYear(), minDob.getMonth(), minDob.getDate(), 12, 0, 0, 0).getTime();
  const maxT = new Date(maxDob.getFullYear(), maxDob.getMonth(), maxDob.getDate(), 12, 0, 0, 0).getTime();
  return tMid >= minT && tMid <= maxT;
}

/**
 * Email estricto: parte local y dominio con etiquetas DNS razonables;
 * exige al menos un punto en el dominio (.com, .com.ar, etc.).
 */
function isValidEmailStrict(raw: string): boolean {
  const email = raw.trim().toLowerCase();
  if (!email || /\s/.test(raw) || email.includes('..')) return false;
  const re =
    /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
  if (!re.test(email)) return false;
  const at = email.lastIndexOf('@');
  const domain = email.slice(at + 1);
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  if (labels.some((label) => !label || label.startsWith('-') || label.endsWith('-'))) return false;
  if (labels[labels.length - 1].length < 2) return false;
  return true;
}

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
  const [emailFieldError, setEmailFieldError] = useState('');
  const [dobFieldError, setDobFieldError] = useState('');

  const { minStr: dobMinStr, maxStr: dobMaxStr, minDob, maxDob } = birthdateBounds();

  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${S.pageBg}`}>
        <img
          src="/android-chrome-192x192.png"
          alt="Pana Fitness Logo"
          className="h-20 w-20 animate-pulse rounded-2xl object-cover shadow-lg"
        />
      </div>
    );
  }

  if (user && !signUpRedirectHold) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setEmailFieldError('');
    setDobFieldError('');

    if (!isValidEmailStrict(email)) {
      setEmailFieldError(EMAIL_FORMAT_ERROR);
      return;
    }

    const emailClean = email.trim();

    if (!isLogin) {
      if (!dateOfBirth) {
        setDobFieldError(DOB_REQUIRED_ERROR);
        return;
      }
      if (!isDobInRange(dateOfBirth, minDob, maxDob)) {
        setDobFieldError(DOB_RANGE_ERROR);
        return;
      }
      if (!firstName.trim() || !lastName.trim() || !gender) {
        setError('Completá nombre, apellido, fecha de nacimiento y género.');
        return;
      }
    }

    setSubmitting(true);

    if (isLogin) {
      const { error } = await signIn(emailClean, password);
      if (error) setError(error.message);
    } else {
      setSignUpRedirectHold(true);
      const { error } = await signUp(emailClean, password, {
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
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <img
          src="/android-chrome-192x192.png"
          alt="Pana Fitness Logo"
          className="h-20 w-20 rounded-2xl object-cover shadow-lg"
        />
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

              <div>
                <Input
                  ref={dobRef}
                  type={dobInputType}
                  placeholder="Fecha de nacimiento"
                  value={dateOfBirth}
                  min={dobMinStr}
                  max={dobMaxStr}
                  onTouchStart={() => setDobInputType('date')}
                  onFocus={() => setDobInputType('date')}
                  onBlur={() => {
                    if (!dateOfBirth) {
                      setDobInputType('text');
                      setDobFieldError('');
                    } else if (!isDobInRange(dateOfBirth, minDob, maxDob)) {
                      setDobFieldError(DOB_RANGE_ERROR);
                    } else {
                      setDobFieldError('');
                    }
                  }}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDateOfBirth(v);
                    if (dobFieldError && v && isDobInRange(v, minDob, maxDob)) setDobFieldError('');
                  }}
                  required
                  className={cn(
                    S.inputCls,
                    'appearance-none overflow-hidden py-0 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-date-and-time-value]:m-0 [&::-webkit-datetime-edit]:p-0',
                    dobFieldError && 'border-red-500 focus-visible:border-red-500',
                  )}
                />
                {dobFieldError ? (
                  <p className="mt-1.5 text-sm text-red-500">{dobFieldError}</p>
                ) : null}
              </div>

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
          <div>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailFieldError) setEmailFieldError('');
              }}
              onBlur={() => {
                if (!email.trim()) setEmailFieldError('');
                else if (!isValidEmailStrict(email)) setEmailFieldError(EMAIL_FORMAT_ERROR);
                else setEmailFieldError('');
              }}
              required
              autoComplete="email"
              className={cn(S.inputCls, emailFieldError && 'border-red-500 focus-visible:border-red-500')}
            />
            {emailFieldError ? (
              <p className="mt-1.5 text-sm text-red-500">{emailFieldError}</p>
            ) : null}
          </div>
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
            aria-busy={submitting}
            className={`h-14 w-full rounded-xl text-base font-bold tracking-tight transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:opacity-60 ${S.btnTextCls}`}
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
            setEmailFieldError('');
            setDobFieldError('');
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
