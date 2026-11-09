import { LegalPage } from '@/components/LegalPage';

export const metadata = { title: 'Términos de uso' };

export default function TermsPage() {
  return (
    <LegalPage title="Términos de uso" updated="8 de noviembre de 2026">
      <p>
        Al usar Reservahoy aceptas estos términos. Si no estás de acuerdo, no
        uses el servicio.
      </p>

      <h2>El servicio</h2>
      <p>
        Reservahoy ofrece herramientas para que negocios publiquen su
        disponibilidad y reciban reservas online. El servicio está en una etapa
        temprana y se entrega &quot;tal cual&quot;, sin garantía de disponibilidad
        continua.
      </p>

      <h2>Cuentas de negocio</h2>
      <ul>
        <li>Debes entregar información verdadera y mantener segura tu contraseña.</li>
        <li>Eres responsable de la actividad de tu cuenta y de tu equipo.</li>
        <li>
          Eres responsable del trato de los datos de tus clientes y de informarles
          cómo los usas.
        </li>
      </ul>

      <h2>Reservas</h2>
      <p>
        Las reservas son un acuerdo entre el cliente y el negocio. Reservahoy
        no garantiza que el servicio se preste ni gestiona pagos entre ellos.
        Cada negocio define sus propias políticas de atención y cancelación.
      </p>

      <h2>Uso aceptable</h2>
      <p>
        No está permitido usar el servicio para enviar correo no solicitado,
        suplantar a otras personas, intentar vulnerar la plataforma o afectar su
        funcionamiento.
      </p>

      <h2>Limitación de responsabilidad</h2>
      <p>
        En la medida permitida por la ley, Reservahoy no responde por pérdidas
        derivadas de interrupciones del servicio, reservas no atendidas o errores
        de terceros.
      </p>

      <h2>Terminación</h2>
      <p>
        Puedes dejar de usar el servicio cuando quieras y solicitar la
        eliminación de tu cuenta. Podemos suspender cuentas que incumplan estos
        términos.
      </p>

      <h2>Contacto</h2>
      <p>
        Para consultas: <strong>[joseignaciodiazh@gmail.com]</strong>.
      </p>
    </LegalPage>
  );
}