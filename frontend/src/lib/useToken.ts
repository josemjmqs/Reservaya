"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function useToken() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) router.replace("/login");
    else setToken(t);
  }, [router]);

  return token;
}
