import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dumbbell } from 'lucide-react';

const Auth = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Dumbbell className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    const { error } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password);

    if (error) {
      setError(error.message);
    } else if (!isLogin) {
      setSuccessMsg('¡Cuenta creada! Revisa tu email para confirmar.');
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
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-14 rounded-xl border-none bg-card text-foreground placeholder:text-muted-foreground"
        />
        <Input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
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
          onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }}
          className="w-full text-center text-sm text-muted-foreground"
        >
          {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </form>
    </div>
  );
};

export default Auth;
