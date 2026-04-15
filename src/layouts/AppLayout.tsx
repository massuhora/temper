import * as React from "react"
import { Flame, BookOpen, BarChart3, Database, Library, Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"
import { useLanguage } from "@/hooks/useLanguage"

type PageKey = "today" | "bank" | "practice" | "stats" | "data" | "knowledge"

interface AppLayoutProps {
  page: PageKey
  onChangePage: (page: PageKey) => void
  children: React.ReactNode
}

function NavItem({
  item,
  active,
  onClick,
}: {
  item: { key: PageKey; label: string; icon: React.ElementType }
  active: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-sidebar-foreground hover:bg-accent/60 hover:text-accent-foreground"
      )}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={1.5} />
      <span>{item.label}</span>
    </button>
  )
}

function SidebarContent({
  page,
  onChangePage,
}: {
  page: PageKey
  onChangePage: (page: PageKey) => void
}) {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()

  const navItems: { key: PageKey; label: string; icon: React.ElementType }[] = [
    { key: "today", label: t('nav.today'), icon: Flame },
    { key: "bank", label: t('nav.bank'), icon: BookOpen },
    { key: "knowledge", label: t('nav.knowledge'), icon: Library },
    { key: "stats", label: t('nav.stats'), icon: BarChart3 },
    { key: "data", label: t('nav.data'), icon: Database },
  ]

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
          {t('app.name')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('app.tagline')}</p>
      </div>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavItem
            key={item.key}
            item={item}
            active={page === item.key}
            onClick={() => onChangePage(item.key)}
          />
        ))}
      </nav>
      <div className="mt-auto">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setLanguage("en")}
            className={cn(
              "text-xs px-2 py-1 rounded transition-colors",
              language === "en" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >EN</button>
          <button
            onClick={() => setLanguage("zh")}
            className={cn(
              "text-xs px-2 py-1 rounded transition-colors",
              language === "zh" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >中</button>
        </div>
      </div>
    </div>
  )
}

export function AppLayout({ page, onChangePage, children }: AppLayoutProps) {
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const handleNav = (p: PageKey) => {
    onChangePage(p)
    setMobileOpen(false)
  }

  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 hidden h-full w-60 bg-sidebar md:block">
        <SidebarContent page={page} onChangePage={onChangePage} />
      </aside>

      {/* Mobile Top Bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 py-3 md:hidden">
        <div className="flex flex-col">
          <span className="font-display text-lg font-bold leading-none">{t('app.name')}</span>
          <span className="text-[11px] text-muted-foreground">{t('app.tagline')}</span>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9">
              <Menu className="size-5" strokeWidth={1.5} />
              <span className="sr-only">{t('nav.openMenu')}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 bg-sidebar p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{t('nav.navigation')}</SheetTitle>
            </SheetHeader>
            <SidebarContent page={page} onChangePage={handleNav} />
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-56px)] p-4 md:ml-60 md:min-h-screen md:p-6">
        {children}
      </main>
    </div>
  )
}
