import { useState, useRef, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeSegmentedControl } from '@/components/ThemeSegmentedControl';
import { cn } from '@/lib/utils';
import { passwordMeetsPolicy } from '@/lib/passwordPolicy';
import { PasswordRequirementsList } from '@/components/PasswordRequirementsList';
import { motion, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

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
    'h-14 rounded-xl border text-sm transition-all duration-200',
    'focus-visible:ring-0 focus-visible:ring-offset-0',
    'focus-visible:border-primary',
    isDark
      ? 'border-white/10 bg-zinc-800/50 text-white placeholder:text-zinc-400 caret-primary'
      : 'border-zinc-200 bg-zinc-100 text-zinc-900 placeholder:text-zinc-500 caret-primary',
  ].join(' ');

  const genderPillTrack = isDark
    ? 'border-white/10 bg-zinc-800/40'
    : 'border-zinc-200 bg-zinc-100/90';

  const toggleTextCls = isDark
    ? 'text-zinc-400 hover:text-zinc-200'
    : 'text-zinc-600 hover:text-zinc-900';

  return {
    pageBg,
    titleColor,
    subtitleColor,
    card,
    inputCls,
    genderPillTrack,
    toggleTextCls,
  };
}

/* ─── Component ──────────────────────────────────────────────────────────── */

const Auth = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const { theme, setTheme, resolved } = useTheme();
  const isDark = resolved === 'dark';
  const S = useAuthStyles(isDark);
  const prefersReducedMotion = useReducedMotion();

  const { cascadeContainer, cascadeItem, formCascadeContainer } = useMemo(() => {
    if (prefersReducedMotion) {
      const neutralItem = {
        hidden: { opacity: 1, y: 0 },
        visible: { opacity: 1, y: 0, transition: { duration: 0 } },
      } as const;
      return {
        cascadeContainer: { hidden: {}, visible: { transition: { staggerChildren: 0 } } } as const,
        cascadeItem: neutralItem,
        formCascadeContainer: { hidden: {}, visible: { transition: { staggerChildren: 0 } } } as const,
      };
    }
    const easeOut = 'easeOut' as const;
    return {
      cascadeContainer: {
        hidden: {},
        visible: { transition: { staggerChildren: 0.065, delayChildren: 0.02 } },
      } as const,
      cascadeItem: {
        hidden: { opacity: 0, y: 15 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.25, ease: easeOut },
        },
      } as const,
      formCascadeContainer: {
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.045, delayChildren: 0.08 },
        },
      } as const,
    };
  }, [prefersReducedMotion]);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [signUpRedirectHold, setSignUpRedirectHold] = useState(false);
  const [dobInputType, setDobInputType] = useState<'text' | 'date'>('text');
  const dobRef = useRef<HTMLInputElement>(null);
  const [emailFieldError, setEmailFieldError] = useState('');
  const [dobFieldError, setDobFieldError] = useState('');

  const passwordsMatch = password === confirmPassword;
  const registerSubmitEnabled =
    isLogin || (passwordMeetsPolicy(password) && passwordsMatch);

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
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      if (!passwordMeetsPolicy(password)) {
        setError(
          'La contraseña debe tener al menos 8 caracteres, una mayúscula y un carácter especial.',
        );
        return;
      }
    }

    setIsLoading(true);

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

    setIsLoading(false);
  };

  return (
    <div className={cn('relative flex min-h-screen flex-col items-center justify-center px-5 pb-10 pt-20', S.pageBg)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end p-4">
        <div className="pointer-events-auto">
          <ThemeSegmentedControl value={theme} onChange={setTheme} />
        </div>
      </div>

      <motion.div
        className="flex w-full max-w-sm flex-col items-center gap-8"
        variants={cascadeContainer}
        initial="hidden"
        animate="visible"
      >
        {/* ── Logo ── */}
        <motion.div
          className="flex flex-col items-center gap-3 text-center"
          variants={cascadeItem}
        >
          <img
            src="/android-chrome-192x192.png"
            alt="Pana Fitness Logo"
            className="h-20 w-20 rounded-2xl object-cover shadow-lg"
          />
          <h1 className={`text-2xl font-extrabold tracking-tight ${S.titleColor}`}>
            Pana Fitness
          </h1>
          <p className={`text-sm ${S.subtitleColor}`}>Tu compañero de fitness</p>
        </motion.div>

        {/* ── Glass card ── */}
        <motion.div className={cn('w-full rounded-3xl p-7', S.card)} variants={cascadeItem}>
            <motion.form
            key={isLogin ? 'login' : 'signup'}
            variants={formCascadeContainer}
            initial="hidden"
            animate="visible"
            onSubmit={handleSubmit}
            className="flex flex-col gap-3"
          >
            <motion.h2
              className={cn(`mb-6 text-lg font-bold tracking-tight`, S.titleColor)}
              variants={cascadeItem}
            >
              {isLogin ? 'Iniciar Sesión' : 'Crear cuenta'}
            </motion.h2>

              {/* ── Register-only fields ── */}
              {!isLogin && (
                <>
                  <motion.div className="grid grid-cols-2 gap-3" variants={cascadeItem}>
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
              </motion.div>

              <motion.div variants={cascadeItem}>
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
              </motion.div>

              <motion.div variants={cascadeItem} className="flex flex-col gap-2">
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Género</p>
                <div className={cn('flex gap-2 rounded-2xl border p-1', S.genderPillTrack)}>
                  {(
                    [
                      { value: 'male' as const, label: 'Masculino' },
                      { value: 'female' as const, label: 'Femenino' },
                    ] as const
                  ).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGender(value)}
                      className={cn(
                        'flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all',
                        gender === value
                          ? 'bg-primary text-primary-foreground shadow-[0_4px_14px_var(--brand-glow-sm)] dark:text-black'
                          : isDark
                            ? 'text-zinc-400 hover:bg-zinc-800/80'
                            : 'text-zinc-600 hover:bg-white/80',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}

              {/* ── Common fields ── */}
              <motion.div variants={cascadeItem}>
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
              </motion.div>

              <motion.div variants={cascadeItem} className="relative">
            <Input
              type={
                isLogin
                  ? showLoginPassword
                    ? 'text'
                    : 'password'
                  : showRegPassword
                    ? 'text'
                    : 'password'
              }
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              {...(!isLogin ? { minLength: 8 } : {})}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              className={cn(S.inputCls, 'pr-12')}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() =>
                isLogin ? setShowLoginPassword((v) => !v) : setShowRegPassword((v) => !v)
              }
              className={cn(
                'absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl transition-colors',
                isDark
                  ? 'text-zinc-400 hover:bg-white/10 hover:text-zinc-100'
                  : 'text-zinc-500 hover:bg-zinc-200/80 hover:text-zinc-900',
              )}
              aria-label={
                (isLogin ? showLoginPassword : showRegPassword)
                  ? 'Ocultar contraseña'
                  : 'Mostrar contraseña'
              }
            >
              {(isLogin ? showLoginPassword : showRegPassword) ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
              </motion.div>
              {!isLogin ? (
            <motion.div variants={cascadeItem}>
              <PasswordRequirementsList password={password} className="mt-1.5" />
            </motion.div>
              ) : null}

              {!isLogin && (
            <motion.div variants={cascadeItem}>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirmar contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={cn(
                    S.inputCls,
                    'pr-12',
                    confirmPassword.length > 0 && !passwordsMatch && 'border-red-500/80 focus-visible:border-red-500',
                  )}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className={cn(
                    'absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl transition-colors',
                    isDark
                      ? 'text-zinc-400 hover:bg-white/10 hover:text-zinc-100'
                      : 'text-zinc-500 hover:bg-zinc-200/80 hover:text-zinc-900',
                  )}
                  aria-label={showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch ? (
                <p className="mt-1.5 text-sm text-red-500">Las contraseñas no coinciden</p>
              ) : null}
            </motion.div>
              )}

              {error ? (
            <motion.div variants={cascadeItem}>
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
            </motion.div>
              ) : null}
              {successMsg ? (
            <motion.div variants={cascadeItem}>
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
              {successMsg}
            </p>
            </motion.div>
              ) : null}

              <motion.div variants={cascadeItem}>
          <Button
            type="submit"
            disabled={isLoading || !registerSubmitEnabled}
            aria-busy={isLoading}
            className={cn(
              'h-14 w-full rounded-xl border-0 bg-primary text-base font-bold tracking-tight text-primary-foreground',
              'shadow-[0_0_24px_var(--brand-glow),0_4px_18px_var(--brand-color-dim)] transition-all duration-300',
              'hover:bg-[color:var(--brand-hover)] hover:shadow-[0_0_32px_var(--brand-glow-lg)] active:scale-[0.98]',
              'disabled:pointer-events-none disabled:opacity-50 dark:text-black',
                  '[&_svg]:size-6',
                )}
              >
                {isLoading ? (
                  <>
                    <span className="sr-only">{isLogin ? 'Iniciando sesión…' : 'Creando cuenta…'}</span>
                    <Loader2
                      className={cn(
                        'shrink-0 animate-spin',
                        'text-primary-foreground dark:text-black',
                      )}
                      aria-hidden
                    />
                  </>
                ) : isLogin ? (
                  'Iniciar Sesión'
                ) : (
                  'Crear Cuenta'
                )}
          </Button>
              </motion.div>

              {/* ── Toggle login / register ── */}
              <motion.div variants={cascadeItem}>
        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setSignUpRedirectHold(false);
            setError('');
            setSuccessMsg('');
            setEmailFieldError('');
            setDobFieldError('');
            setConfirmPassword('');
            setShowLoginPassword(false);
            setShowRegPassword(false);
            setShowConfirmPassword(false);
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
              </motion.div>
            </motion.form>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Auth;
