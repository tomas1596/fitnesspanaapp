import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { evaluatePasswordPolicy } from '@/lib/passwordPolicy';

type Props = {
  password: string;
  className?: string;
};

const ITEMS: { key: keyof ReturnType<typeof evaluatePasswordPolicy>; label: string }[] = [
  { key: 'minLength', label: 'Mínimo 8 caracteres' },
  { key: 'hasUppercase', label: 'Una letra mayúscula' },
  { key: 'hasSpecial', label: 'Un carácter especial (@, #, $, …)' },
];

/** Lista minimalista: requisitos en gris y neón al cumplirse. */
export function PasswordRequirementsList({ password, className }: Props) {
  const c = evaluatePasswordPolicy(password);

  return (
    <ul className={cn('space-y-2 text-xs', className)} aria-live="polite">
      {ITEMS.map(({ key, label }) => {
        const ok = c[key];
        return (
          <li
            key={key}
            className={cn(
              'flex items-center gap-2 transition-colors duration-200',
              ok ? 'text-pink-600 dark:text-[#FF1493]' : 'text-zinc-500 dark:text-zinc-500',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
                ok
                  ? 'border-pink-500 bg-pink-500/15 text-pink-600 dark:border-[#FF1493] dark:bg-[#FF1493]/15 dark:text-[#FF1493]'
                  : 'border-zinc-200 bg-zinc-50 text-transparent dark:border-zinc-600 dark:bg-zinc-800/80',
              )}
            >
              {ok ? <Check className="h-3 w-3 stroke-[3]" aria-hidden /> : null}
            </span>
            <span className={cn('leading-snug', ok && 'font-medium')}>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
