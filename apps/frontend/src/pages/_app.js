import "@/styles/globals.css";
import { AppLayout } from "@/components/layout/AppLayout";
import { ThemeProvider } from "next-themes";
import { useAuthStore } from "@/store/auth.store";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { LockScreen } from "@/components/auth/LockScreen";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function App({ Component, pageProps }) {
  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout || ((page) => <AppLayout>{page}</AppLayout>);
  
  const { isLocked, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Hanya redirect setelah komponen di-mount untuk mencegah hydration mismatch
    if (isMounted && !isAuthenticated && router.pathname !== "/login") {
      router.push("/login");
    }
  }, [isMounted, isAuthenticated, router.pathname]);
  
  // Initialize Idle Timeout (30 minutes)
  useIdleTimeout(30 * 60 * 1000);

  // Mencegah rendering sampai status otentikasi dipastikan (kecuali halaman login)
  if (!isMounted) return null;
  if (!isAuthenticated && router.pathname !== "/login") return null;

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {isLocked ? <LockScreen /> : getLayout(<Component {...pageProps} />)}
    </ThemeProvider>
  );
}
