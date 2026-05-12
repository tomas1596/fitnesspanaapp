import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dumbbell } from 'lucide-react';

const Auth = () => {
  const { user, loading, signIn, signUp } = useAuth();
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
  /** Tras registro exitoso, espera 800 ms antes de dejar que <Navigate> mande al dashboard (tiempo al trigger). */
  const [signUpRedirectHold, setSignUpRedirectHold] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Dumbbell className="h-8 w-8 animate-pulse text-primary" />
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Dumbbell className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Pana Fitness</h1>
        <p className="text-sm text-muted-foreground">Tu compañero de fitness</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {!isLogin && (
          <>
            <Input
              type="text"
              placeholder="Nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required={!isLogin}
              autoComplete="given-name"
              className="h-14 rounded-xl border-none bg-card text-foreground placeholder:text-muted-foreground"
            />
            <Input
              type="text"
              placeholder="Apellido"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required={!isLogin}
              autoComplete="family-name"
              className="h-14 rounded-xl border-none bg-card text-foreground placeholder:text-muted-foreground"
            />
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Fecha de nacimiento</label>
              <Input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required={!isLogin}
                className="h-14 rounded-xl border-none bg-card text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Género</label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="h-14 rounded-xl border-none bg-card text-foreground">
                  <SelectValue placeholder="Seleccionar género" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="female">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="h-14 rounded-xl border-none bg-card text-foreground placeholder:text-muted-foreground"
        />
        <Input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          className="h-14 rounded-xl border-none bg-card text-foreground placeholder:text-muted-foreground"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}
        {successMsg && <p className="text-sm text-primary">{successMsg}</p>}

        <Button
          type="submit"
          disabled={submitting}
          className="h-14 w-full rounded-xl text-base font-semibold"
        >
          {submitting ? '...' : isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
        </Button>

        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setSignUpRedirectHold(false);
            setError('');
            setSuccessMsg('');
          }}
          className="w-full text-center text-sm text-muted-foreground"
        >
          {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </form>
    </div>
  );
};

export default Auth;
