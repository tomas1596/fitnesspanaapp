const DEFAULT_SUPPORT_E164 = '5493388414236';
const DEFAULT_SUPPORT_MESSAGE = 'Hola, necesito ayuda con Pana Fitness';

function resolveSupportWhatsAppE164(): string {
  const raw = import.meta.env.VITE_SUPPORT_WHATSAPP_E164 as string | undefined;
  const digits = raw?.replace(/\D/g, '') ?? '';
  if (!digits || /X/i.test(digits) || digits.length < 10) return DEFAULT_SUPPORT_E164;
  return digits;
}

/** URL de WhatsApp para soporte (`VITE_SUPPORT_WHATSAPP_E164` en .env). */
export function getSupportWhatsAppUrl(message = DEFAULT_SUPPORT_MESSAGE): string {
  return `https://wa.me/${resolveSupportWhatsAppE164()}?text=${encodeURIComponent(message)}`;
}
