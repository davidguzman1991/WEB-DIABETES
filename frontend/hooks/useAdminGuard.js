import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { getAdminToken } from "../lib/adminApi";

export function useAdminGuard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setLoading(false);
  }, [router]);

  return { loading };
}
