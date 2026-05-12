import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield } from 'lucide-react';

const AdminPanel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 pb-8 pt-6">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
            onClick={() => navigate(-1)}
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Shield className="h-7 w-7 shrink-0 text-violet-500" />
            <h1 className="text-xl font-bold text-foreground">Administración</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Herramientas internas. Los permisos se gestionan con la columna{' '}
          <span className="font-mono text-foreground">is_admin</span> en Supabase.
        </p>
      </div>
    </div>
  );
};

export default AdminPanel;
