import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, Copy } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getSupportWhatsAppUrl } from '@/lib/supportWhatsApp';

const SUPPORT_WHATSAPP_URL = getSupportWhatsAppUrl();

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
          <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-sm font-semibold text-primary dark:bg-primary/15 dark:text-primary">
            {MP_ALIAS}
          </span>
          <CopyAliasButton />
        </span>
        .
      </>
    ),
  },
  {
    question: '¿Cómo confirmo mi pago?',
    answer:
      'Una vez realizado el pago, envía el comprobante por WhatsApp para que activemos tu cuenta de forma inmediata.',
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
        <DrawerHeader className="border-0 px-4 pb-2 pt-0 text-left">
          <DrawerTitle className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">FAQ - Pana Fitness</DrawerTitle>
          <DrawerDescription className="sr-only">
            Preguntas frecuentes sobre suscripción, pagos y cuenta.
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto overscroll-contain px-3 pb-10 pt-1">
          <div className="space-y-2">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = expanded === i;
              return (
                <div
                  key={item.question}
                  className="overflow-hidden rounded-2xl bg-zinc-100/90 shadow-sm dark:bg-zinc-900/80"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200/50 dark:text-zinc-100 dark:hover:bg-zinc-800/90"
                  >
                    <span className="pr-2 leading-snug">{item.question}</span>
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
                      <div className="px-4 pb-3.5 pt-0 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                        {item.answer}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold transition active:scale-[0.99]',
              'border-2 border-primary bg-primary/15 text-zinc-900 shadow-[0_0_24px_var(--brand-glow-sm)]',
              'hover:bg-primary/25 dark:text-zinc-50 dark:shadow-[0_0_28px_var(--brand-glow-sm)]',
            )}
            style={{ marginBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="#25D366" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Contacto directo
          </a>
        </div>
      </DrawerContent>
    </Drawer>
  );
}