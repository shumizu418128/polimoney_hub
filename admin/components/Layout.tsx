import { ComponentChildren } from "preact";

interface LayoutProps {
  children: ComponentChildren;
  active?: string;
}

export default function Layout({ children, active }: LayoutProps) {
  const menuItems = [
    { href: "/", label: "ダッシュボード", icon: "📊" },
    { href: "/election-requests", label: "選挙リクエスト", icon: "🗳️" },
    { href: "/organization-requests", label: "政治団体リクエスト", icon: "🏛️" },
    { href: "/elections", label: "選挙マスタ", icon: "📅" },
    { href: "/organizations", label: "政治団体マスタ", icon: "🏢" },
  ];

  return (
    <div class="drawer lg:drawer-open">
      <input id="drawer" type="checkbox" class="drawer-toggle" />
      
      <div class="drawer-content flex flex-col">
        {/* Navbar */}
        <div class="navbar bg-primary text-primary-content shadow-lg lg:hidden">
          <div class="flex-none">
            <label for="drawer" class="btn btn-square btn-ghost">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-6 h-6 stroke-current">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </label>
          </div>
          <div class="flex-1">
            <span class="text-xl font-bold">Polimoney Hub</span>
          </div>
        </div>

        {/* Main content */}
        <main class="flex-1 p-6">
          {children}
        </main>
      </div>

      {/* Sidebar */}
      <div class="drawer-side">
        <label for="drawer" class="drawer-overlay"></label>
        <aside class="bg-primary text-primary-content w-64 min-h-screen">
          <div class="p-4 border-b border-primary-content/20">
            <h1 class="text-xl font-bold">🍋 Polimoney Hub</h1>
            <p class="text-sm opacity-70">管理画面</p>
          </div>
          <ul class="menu p-4 gap-1">
            {menuItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  class={`${active === item.href ? "bg-secondary" : "hover:bg-secondary/50"}`}
                >
                  <span class="text-lg">{item.icon}</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

