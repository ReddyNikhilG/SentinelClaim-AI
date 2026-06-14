import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutDashboard, 
  FileText, 
  PlusCircle, 
  BarChart3, 
  Bell, 
  Settings,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Menu,
  X,
  Activity,
  Gauge
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { ClaimsAssistantChat } from '@/components/chat/ClaimsAssistantChat';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'All Claims', href: '/claims', icon: FileText },
  { name: 'New Claim (FNOL)', href: '/claims/new', icon: PlusCircle },
  { name: 'Fraud Analytics', href: '/analytics', icon: BarChart3 },
];

const adminNavigation = [
  { name: 'Admin Panel', href: '/admin', icon: UserCog },
  { name: 'SLA Dashboard', href: '/sla-dashboard', icon: Gauge },
  { name: 'Activity Log', href: '/activity-log', icon: Activity },
];

const allNavItems = [...navigation, ...adminNavigation];

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const { user, userRole, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const [collapsed, setCollapsed] = React.useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const isMobile = useIsMobile();
  useKeyboardShortcuts();

  // Close mobile menu when route changes
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu when resizing to desktop
  React.useEffect(() => {
    if (!isMobile) {
      setMobileMenuOpen(false);
    }
  }, [isMobile]);

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-4 border-b border-sidebar-border">
        {(!collapsed || isMobile) && (
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-sidebar-primary" />
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg text-sidebar-foreground">ClaimGuard</span>
              {userRole && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 w-fit capitalize">
                  {userRole === 'siu_analyst' ? 'SIU Analyst' : userRole}
                </Badge>
              )}
            </div>
          </div>
        )}
        {collapsed && !isMobile && <Shield className="h-8 w-8 text-sidebar-primary mx-auto" />}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground hover:bg-sidebar-accent h-7 w-7 sm:h-8 sm:w-8"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 sm:py-4 px-2 space-y-1 overflow-y-auto custom-scrollbar">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "nav-item",
                isActive && "active"
              )}
              title={collapsed && !isMobile ? item.name : undefined}
              onClick={() => isMobile && setMobileMenuOpen(false)}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {(!collapsed || isMobile) && <span className="text-sm sm:text-base">{item.name}</span>}
            </Link>
          );
        })}
        
        {/* Admin Navigation - Only show for admins */}
        {userRole === 'admin' && (
          <>
            <div className="my-2 border-t border-sidebar-border" />
            {adminNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "nav-item",
                    isActive && "active"
                  )}
                  title={collapsed && !isMobile ? item.name : undefined}
                  onClick={() => isMobile && setMobileMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {(!collapsed || isMobile) && <span className="text-sm sm:text-base">{item.name}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User Section */}
      <div className="p-3 sm:p-4 border-t border-sidebar-border">
        {(!collapsed || isMobile) && (
          <div className="mb-3">
            <p className="text-xs sm:text-sm font-medium text-sidebar-foreground truncate">
              {user?.email}
            </p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">
              {userRole || 'User'}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size={(collapsed && !isMobile) ? "icon" : "default"}
          onClick={signOut}
          className={cn(
            "text-sidebar-foreground hover:bg-sidebar-accent",
            (collapsed && !isMobile) ? "w-full justify-center" : "w-full justify-start gap-2"
          )}
        >
          <LogOut className="h-4 w-4" />
          {(!collapsed || isMobile) && "Sign Out"}
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 h-screen bg-gradient-sidebar border-r border-sidebar-border transition-all duration-300 z-50 flex-col hidden md:flex",
          collapsed ? "w-16" : "w-56 lg:w-64",
          userRole === 'admin' && "role-sidebar-admin",
          userRole === 'adjuster' && "role-sidebar-adjuster",
          userRole === 'siu_analyst' && "role-sidebar-siu"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 h-screen bg-gradient-sidebar border-r border-sidebar-border transition-transform duration-300 z-50 flex flex-col w-72 md:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          userRole === 'admin' && "role-sidebar-admin",
          userRole === 'adjuster' && "role-sidebar-adjuster",
          userRole === 'siu_analyst' && "role-sidebar-siu"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        "md:ml-16",
        !collapsed && "lg:ml-56 xl:ml-64"
      )}>
        {/* Top Header */}
        <header className="h-14 sm:h-16 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden h-9 w-9"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-sm sm:text-lg font-semibold text-foreground truncate max-w-[180px] sm:max-w-none">
                {allNavItems.find(n => location.pathname === n.href || (n.href !== '/dashboard' && location.pathname.startsWith(n.href)))?.name 
                  || (location.pathname.startsWith('/notifications') ? 'Notifications' 
                  : location.pathname.startsWith('/settings') ? 'Settings'
                  : location.pathname.startsWith('/notification-preferences') ? 'Notification Preferences'
                  : 'Dashboard')}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <Link 
              to="/notifications" 
              className="relative p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 sm:h-5 sm:w-5 bg-destructive text-destructive-foreground text-[10px] sm:text-xs font-medium rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <Link 
              to="/settings" 
              className="relative p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Settings className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-primary rounded-full border-2 border-background" />
              )}
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6">
          {children}
        </main>

        {/* Footer - Karthikeya Branding */}
        <footer className="px-4 sm:px-6 py-4 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Enterprise Claims Orchestration Platform
          </p>
        </footer>

        {/* AI Chat Assistant */}
        <ClaimsAssistantChat />
      </div>
    </div>
  );
}
