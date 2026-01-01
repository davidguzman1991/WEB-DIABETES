import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { clearToken, fetchMe, getToken } from "../lib/auth";

export function useAdminGuard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const token = getToken();
    if (!token) {
      router.replace("/admin/login");
      if (active) setLoading(false);
      return () => {
        active = false;
      };
    }
    fetchMe()
      .then((data) => {
        if (!active) return;
        const role = String(data?.role || "").toLowerCase();
        if (role !== "admin") {
          clearToken();
          router.replace("/admin/login");
          setLoading(false);
          return;
        }
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        clearToken();
        router.replace("/admin/login");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  return { loading };
}
