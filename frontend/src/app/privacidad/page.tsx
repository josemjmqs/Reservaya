import { LegalPage } from '@/components/LegalPage';

export const metadata = { title: 'Política de privacidad' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad" updated="8 de noviembre de 2026">
      <p>
        Reservahoy es una plataforma que permite a negocios recibir reservas
        online. Esta política explica qué datos se recogen y cómo se usan.
      </p>

      <h2>Quién es responsable</h2>
      <p>
        Cuando reservas una hora, el <strong>negocio</strong> con el que reservas
        decide para qué usa tus datos. Reservahoy actúa como proveedor de la
        plataforma que los almacena y procesa por cuenta del negocio.
      </p>

      <h2>Datos que recogemos</h2>
      <ul>
        <li>
          <strong>Clientes que reservan:</strong> nombre, correo, teléfono
          (opcional), notas (opcional) y los datos de la reserva.
        </li>
        <li>
          <strong>Negocios y su equipo:</strong> nombre, correo, contraseña
          (almacenada de forma cifrada irreversible) y datos del negocio.
        </li>
        <li>
          <strong>Datos técnicos:</strong> dirección IP, usada para limitar abusos,
          y una cookie de sesión para quienes inician sesión.
        </li>
      </ul>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Gestionar y confirmar reservas, y permitir cancelarlas.</li>
        <li>Enviar correos transaccionales (confirmación, recuperación de contraseña).</li>
        <li>Mantener la seguridad y el funcionamiento del servicio.</li>
      </ul>
      <p>No vendemos datos ni los usamos para publicidad.</p>

      <h2>Quién los procesa</h2>
      <p>
        Usamos proveedores de infraestructura: Vercel (alojamiento web), Render
        (servidor), Neon (base de datos), Resend (envío de correos) y Cloudflare
        (DNS y almacenamiento de respaldos cifrados). Algunos operan fuera de
        Chile, por lo que los datos pueden almacenarse en otros países.
      </p>

      <h2>Cookies</h2>
      <p>
        Solo usamos una cookie de sesión necesaria para quienes inician sesión.
        No usamos cookies de seguimiento ni publicidad.
      </p>

      <h2>Cuánto tiempo los conservamos</h2>
      <p>
        Mientras el negocio use la plataforma o sea necesario para el servicio.
        Los respaldos cifrados se eliminan automáticamente a los 30 días.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes solicitar acceso, rectificación o eliminación de tus datos
        escribiendo a <strong>[joseignaciodiazh@gmail.com]</strong>, o al negocio con el
        que reservaste.
      </p>

      <h2>Cambios</h2>
      <p>
        Si actualizamos esta política, cambiaremos la fecha de arriba.
      </p>
    </LegalPage>
  );
}