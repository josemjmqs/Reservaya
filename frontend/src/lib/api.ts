export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    // Con FormData el navegador pone el Content-Type (multipart con su boundary)
    headers:
      options.body instanceof FormData
        ? options.headers
        : { "Content-Type": "application/json", ...options.headers },
  });

  // En el panel, un 401 es una sesión que venció o se cerró (por ejemplo, al
  // cambiar la contraseña en otro dispositivo): se va al login con un aviso en
  // vez de mostrar "Unauthorized". La promesa queda pendiente para que la
  // pantalla no alcance a mostrar el error mientras navega. /auth/me queda
  // fuera: al abrir el panel sin sesión, dashboard/layout lleva al login sin aviso
  if (
    res.status === 401 &&
    path !== "/auth/me" &&
    window.location.pathname.startsWith("/dashboard")
  ) {
    // Navegación completa a propósito: api() no es un componente (no hay
    // useRouter) y así se deja atrás todo el estado del panel
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login?expired=1");
    return new Promise<T>(() => {});
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : (body?.message ?? "Error inesperado");
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}
