import { cookies } from "next/headers";
import Sidebar from "@/components/Sidebar";
import NavPrefsProvider from "@/components/NavPrefsProvider";
import SessionProvider from "@/components/SessionProvider";
import { currentAccount } from "@/lib/auth-server";
import { NAV_COOKIE } from "@/lib/prefs";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read here rather than in the root layout: the menu only exists below this
  // segment, and the settings page needs to share its state with the sidebar.
  const [navPref, account] = await Promise.all([
    cookies().then((c) => c.get(NAV_COOKIE)?.value ?? null),
    // Never null in practice — the proxy has already turned away anyone
    // without a valid cookie — but the type stays honest.
    currentAccount(),
  ]);

  return (
    <SessionProvider account={account}>
      {/* Nested inside the session so the menu can be filtered by role before
          its first paint, rather than reshuffling once the client knows. */}
      <NavPrefsProvider initial={navPref}>
        <div className="h-full flex">
          <Sidebar />
          <main className="flex-1 overflow-y-auto pt-11 md:pt-0">
            {children}
          </main>
        </div>
      </NavPrefsProvider>
    </SessionProvider>
  );
}
