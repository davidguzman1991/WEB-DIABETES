import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { clearToken, fetchMe, getToken } from "../lib/auth";

export function useAuthGuard(options = {}) {
  const router = useRouter();
  const mode = options.mode || "me";
  const redirectTo = options.redirectTo || "/login";
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const token = getToken();
    if (!token) {
      router.replace(redirectTo);
      if (active) setLoading(false);
      return () => {
        active = false;
      };
    }

    if (mode === "token") {
      if (active) setLoading(false);
      return () => {
        active = false;
      };
    }

    fetchMe()
      .then((data) => {
        if (!active) return;
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        clearToken();
        router.replace(redirectTo);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, redirectTo, router]);

  return { user, loading };
}
