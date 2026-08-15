import { cookies } from "next/headers";
import Sidebar from "@/components/Sidebar";
import NavPrefsProvider from "@/components/NavPrefsProvider";
import { NAV_COOKIE } from "@/lib/prefs";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read here rather than in the root layout: the menu only exists below this
  // segment, and the settings page needs to share its state with the sidebar.
  const navPref = (await cookies()).get(NAV_COOKIE)?.value ?? null;

  return (
    <NavPrefsProvider initial={navPref}>
      <div className="h-full flex">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pt-11 md:pt-0">
          {children}
        </main>
      </div>
    </NavPrefsProvider>
  );
}
