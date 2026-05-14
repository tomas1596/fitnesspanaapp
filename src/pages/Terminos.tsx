import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LAST_UPDATED = '12 de mayo de 2026';
const APP_NAME = 'Pana Fitness';
const CONTACT_EMAIL = 'tomaspana06@hotmail.com';
const CONTACT_PHONE = '+549388414236';

// ─── Sección tipada ────────────────────────────────────────────────────────

type Section = {
  title: string;
  content: string | string[];
  highlight?: boolean;
};

const SECTIONS: Section[] = [
  {
    title: '1. Aceptación de los Términos',
    content:
      `Al descargar, instalar o utilizar ${APP_NAME} (en adelante "la Aplicación"), el usuario declara haber leído, entendido y aceptado los presentes Términos y Condiciones en su totalidad. Si no estás de acuerdo con alguno de los términos aquí establecidos, te pedimos que no hagas uso de la Aplicación.`,
  },
  {
    title: '2. Descripción del Servicio',
    content: [
      `${APP_NAME} es una aplicación web progresiva (PWA) diseñada como herramienta personal de registro y seguimiento de actividad física, nutrición y bienestar general.`,
      'La Aplicación permite: registrar rutinas de entrenamiento, llevar un diario de alimentación, monitorear actividad cardiovascular mediante GPS, y visualizar estadísticas de progreso personal.',
      'El servicio se ofrece bajo un modelo de suscripción mensual con un período de prueba inicial de siete (7) días sin costo.',
    ],
  },
  {
    title: '3. DESCARGO DE RESPONSABILIDAD EN SALUD Y NUTRICIÓN',
    highlight: true,
    content: [
      '⚠️ AVISO IMPORTANTE — LEÉ CUIDADOSAMENTE ANTES DE USAR LA APLICACIÓN.',
      `${APP_NAME} es EXCLUSIVAMENTE una herramienta tecnológica de registro y control personal. NO es un servicio médico, nutricional ni de salud de ningún tipo.`,
      'La Aplicación NO provee: diagnósticos médicos de ninguna clase, planes de alimentación o dietas elaborados por profesionales, prescripciones de ejercicio adaptadas a condiciones clínicas, recomendaciones terapéuticas o de tratamiento, ni asesoramiento profesional en nutrición, medicina deportiva u otras disciplinas de la salud.',
      'El usuario es ÚNICA Y EXCLUSIVAMENTE responsable de su salud, integridad física y bienestar al ejecutar cualquier rutina de ejercicio, modificar sus hábitos alimentarios o interpretar cualquier dato presentado por la Aplicación.',
      'Antes de iniciar cualquier programa de ejercicio o cambio en la dieta, el usuario debe consultar con un médico o profesional de la salud habilitado, especialmente si padece condiciones preexistentes, lesiones, embarazo u otras circunstancias de riesgo.',
      `${APP_NAME}, sus desarrolladores, operadores y colaboradores quedan expresamente eximidos de toda responsabilidad derivada de daños físicos, lesiones, problemas de salud o consecuencias de cualquier naturaleza ocasionados por el uso o mal uso de la información contenida en la Aplicación.`,
    ],
  },
  {
    title: '4. Cuenta de Usuario y Suscripción',
    content: [
      'Para acceder a las funciones de la Aplicación, el usuario debe crear una cuenta con un correo electrónico válido y una contraseña segura.',
      'El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso.',
      'La suscripción mensual se activa manualmente por el administrador tras verificar la transferencia de pago al alias de Mercado Pago indicado en la Aplicación.',
      'El período de prueba gratuito de 7 días se otorga una única vez por cuenta. Vencido dicho período, el acceso a nuevas funciones quedará suspendido hasta que se active una suscripción.',
      'Una vez acreditado el pago y activada la suscripción mensual, no se realizarán reembolsos parciales ni totales por cancelación anticipada o falta de uso de la Aplicación.',
      'Nos reservamos el derecho de suspender, desactivar o eliminar la cuenta de cualquier usuario que, a nuestra exclusiva discreción, viole estos Términos, realice un uso fraudulento del sistema o intente vulnerar la seguridad de la Aplicación, sin derecho a reembolso alguno.',
    ],
  },
  {
    title: '5. Exactitud de la Información Nutricional',
    content:
      'Los cálculos de macronutrientes, calorías y métricas de actividad física provistos por la Aplicación son estimaciones basadas en los datos ingresados. No garantizamos la exactitud absoluta de esta información. El usuario es responsable de verificar los valores nutricionales de los alimentos que consume.',
  },
  {
    title: '6. Privacidad y Datos Personales',
    content: [
      'Los datos ingresados por el usuario (medidas corporales, registros de actividad, alimentos, etc.) son almacenados de forma segura en servidores de Supabase y se utilizan exclusivamente para brindar las funcionalidades de la Aplicación.',
      'No comercializamos ni cedemos datos personales a terceros con fines publicitarios.',
      'El usuario puede solicitar la eliminación de su cuenta y todos sus datos asociados contactando al soporte.',
    ],
  },
  {
    title: '7. Propiedad Intelectual',
    content:
      `Todos los derechos sobre el diseño, código fuente, marca y contenidos de ${APP_NAME} son propiedad exclusiva de sus desarrolladores. Queda prohibida la reproducción, distribución o modificación sin autorización expresa y por escrito.`,
  },
  {
    title: '8. Modificaciones al Servicio y a los Términos',
    content:
      'Nos reservamos el derecho de modificar, suspender o discontinuar la Aplicación en cualquier momento sin previo aviso. Asimismo, estos Términos podrán ser actualizados periódicamente. El uso continuado de la Aplicación tras la publicación de cambios implica la aceptación de los nuevos términos.',
  },
  {
    title: '9. Limitación de Responsabilidad',
    content:
      `En la máxima medida permitida por la ley aplicable, ${APP_NAME} y sus responsables no serán liable por daños indirectos, incidentales, especiales o consecuentes que resulten del uso o la imposibilidad de uso de la Aplicación.`,
  },
  {
    title: '10. Ley Aplicable',
    content:
      'Estos Términos se rigen por las leyes de la República Argentina. Cualquier controversia derivada de su interpretación o aplicación será sometida a la jurisdicción de los tribunales ordinarios competentes de General Villegas, Provincia de Buenos Aires, Argentina.',
  },
  {
    title: '11. Contacto',
    content: `Para consultas, reclamos o solicitudes relacionadas con estos Términos, podés comunicarte a: ${CONTACT_EMAIL} o ${CONTACT_PHONE}`,
  },
];

// ─── Componente ────────────────────────────────────────────────────────────

export default function Terminos() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl"
          onClick={() => navigate(-1)}
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-base font-semibold text-foreground">
            Términos y Condiciones
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 pt-6 space-y-8">
        {/* Meta */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Última actualización: {LAST_UPDATED}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Estos Términos y Condiciones regulan el uso de <strong className="text-foreground">{APP_NAME}</strong> y
            constituyen un acuerdo legal entre vos y los operadores de la Aplicación.
          </p>
        </div>

        {/* Sections */}
        {SECTIONS.map((sec) =>
          sec.highlight ? (
            /* ── Sección destacada (descargo de salud) ── */
            <div
              key={sec.title}
              className="rounded-2xl border border-amber-500/40 bg-amber-500/8 p-5 space-y-3 dark:bg-amber-500/10"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  {sec.title}
                </h2>
              </div>
              {(Array.isArray(sec.content) ? sec.content : [sec.content]).map(
                (para, i) => (
                  <p
                    key={i}
                    className={`text-sm leading-relaxed ${
                      i === 0
                        ? 'font-semibold text-amber-700 dark:text-amber-300'
                        : 'text-amber-800/90 dark:text-amber-200/80'
                    }`}
                  >
                    {para}
                  </p>
                ),
              )}
            </div>
          ) : (
            /* ── Sección normal ── */
            <div key={sec.title} className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">{sec.title}</h2>
              {(Array.isArray(sec.content) ? sec.content : [sec.content]).map(
                (para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                    {para}
                  </p>
                ),
              )}
            </div>
          ),
        )}

        {/* Footer */}
        <div className="border-t border-border pt-4 pb-4 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {APP_NAME}. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
