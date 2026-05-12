import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, Copy } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const MP_ALIAS = 'tomaspanadeiro.mp';

function CopyAliasButton() {
  const { toast } = useToast();

  const copy = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      // Esta es la forma moderna y correcta. Solo funciona en HTTPS (Netlify)
      await navigator.clipboard.writeText(MP_ALIAS);
      toast({ title: '¡Copiado!', description: 'El alias se guardó en el portapapeles.' });
    } catch (err) {
      // Si salta esto, es porque lo estás probando en localhost sin HTTPS
      toast({
        title: 'Error de entorno',
        description: 'Copiá el alias a mano. (Esto se soluciona al subir a Netlify).',
        variant: 'destructive',
      });
    }
  }, [toast]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
      onClick={copy}
      aria-label="Copiar alias de Mercado Pago"
    >
      <Copy className="h-4 w-4" />
    </Button>
  );
}

const FAQ_ITEMS: { question: string; answer: ReactNode }[] = [
  {
    question: '¿Cómo funciona la suscripción?',
    answer:
      'Todos los usuarios nuevos tienen 7 días de prueba totalmente gratuitos para probar todas las funciones. Una vez finalizado el período, puedes adquirir la suscripción mensual.',
  },
  {
    question: '¿Cuáles son los métodos de pago?',
    answer: (
      <>
        El pago es por transferencia directa vía Mercado Pago al alias{' '}
        <span className="inline-flex items-center gap-1 align-middle">
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-sm font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            {MP_ALIAS}
          </span>
          <CopyAliasButton />
        </span>
        .
      </>
    ),
  },
  {
    question: '¿Cuándo se activa mi cuenta?',
    answer:
      'La activación es manual. Una vez transferido, el administrador verificará el ingreso y habilitará tu cuenta en unas pocas horas.',
  },
  {
    question: '¿Qué pasa si se me vence la suscripción?',
    answer:
      'No pierdes ningún dato. Tus rutinas y registros quedan guardados, pero se bloqueará el acceso a la carga de nuevos datos hasta renovar el mes.',
  },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FAQBottomSheet({ open, onOpenChange }: Props) {
  const [expanded, setExpanded] = useState<number | null>(0);

  useEffect(() => {
    if (open) setExpanded(0);
  }, [open]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <DrawerContent
        className={cn(
          'max-h-[90vh] border-zinc-200 bg-white text-zinc-900 shadow-2xl transition-transform duration-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100',
          'rounded-t-2xl [&>div:first-child]:mt-3 [&>div:first-child]:h-1 [&>div:first-child]:w-10 [&>div:first-child]:rounded-full [&>div:first-child]:bg-zinc-300 [&>div:first-child]:dark:bg-zinc-600',
        )}
      >
        <DrawerHeader className="border-b border-zinc-200 px-4 pb-3 pt-0 text-left dark:border-zinc-800">
          <DrawerTitle className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Suscripción y ayuda</DrawerTitle>
          <DrawerDescription className="sr-only">
            Preguntas frecuentes sobre suscripción, pagos y cuenta.
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto overscroll-contain px-2 pb-8 pt-1">
          <div className="space-y-1">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = expanded === i;
              return (
                <div
                  key={item.question}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100/90 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
                  >
                    <span className="pr-2">{item.question}</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-300 dark:text-zinc-500',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      'grid transition-[grid-template-rows] duration-300 ease-out',
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-zinc-200 px-3 pb-3 pt-2 text-sm leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                        {item.answer}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}