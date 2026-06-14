import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useClaims } from '@/hooks/useClaims';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Shield, 
  FileText,
  Search,
  UserCog,
  AlertTriangle,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { AdminNotificationPreferences } from '@/components/admin/AdminNotificationPreferences';
import { AdminRoleDefaults } from '@/components/admin/AdminRoleDefaults';
import { AdminEmailLog } from '@/components/admin/AdminEmailLog';

export default function AdminPage() {
  const { userRole } = useAuth();
  const { claims, updateClaim, isUpdating } = useClaims();
  const { users, isLoading: usersLoading, updateUserRole, isUpdatingRole } = useAdminUsers();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClaimForAssign, setSelectedClaimForAssign] = useState<string | null>(null);

  // Only admins can access this page
  if (userRole !== 'admin') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You don't have permission to access the admin panel.</p>
          <Link to="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unassignedClaims = claims.filter(c => 
    !c.assigned_to && (c.status === 'under_review' || c.status === 'siu_investigation')
  );

  const handleRoleChange = (userId: string, newRole: string) => {
    updateUserRole({ userId, role: newRole as 'admin' | 'adjuster' | 'siu_analyst' });
  };

  const handleAssignClaim = (claimId: string, userId: string) => {
    updateClaim({
      claimId,
      updates: { assigned_to: userId },
    });
    setSelectedClaimForAssign(null);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-destructive/10 text-destructive';
      case 'siu_analyst': return 'bg-warning/10 text-warning';
      default: return 'bg-primary/10 text-primary';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">Admin Panel</h2>
          <p className="text-muted-foreground">
            Manage users, roles, and claim assignments
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="assignments" className="gap-2">
              <FileText className="h-4 w-4" />
              Claim Assignments
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notification Prefs
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card className="card-enterprise">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="h-5 w-5 text-accent" />
                  User Roles
                </CardTitle>
                <CardDescription>
                  Manage user permissions and access levels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {usersLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No users found
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredUsers.map((user) => (
                      <div 
                        key={user.user_id} 
                        className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{user.full_name || 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={cn('capitalize', getRoleBadgeColor(user.role))}>
                            {user.role?.replace('_', ' ')}
                          </Badge>
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleRoleChange(user.user_id, value)}
                            disabled={isUpdatingRole}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="adjuster">Adjuster</SelectItem>
                              <SelectItem value="siu_analyst">SIU Analyst</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="space-y-4">
            <Card className="card-enterprise">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-accent" />
                  Pending Assignments
                </CardTitle>
                <CardDescription>
                  Claims awaiting adjuster assignment ({unassignedClaims.length})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unassignedClaims.length === 0 ? (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 mx-auto text-success/30 mb-3" />
                    <p className="text-muted-foreground">All claims are assigned</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unassignedClaims.map((claim) => (
                      <div 
                        key={claim.id} 
                        className="flex items-center justify-between p-4 rounded-lg border border-border"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Link 
                              to={`/claims/${claim.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {claim.claim_number}
                            </Link>
                            <span className={cn('risk-badge', `risk-${claim.risk_category}`)}>
                              {claim.risk_score}%
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {claim.claimant_name} • {claim.assigned_group}
                          </p>
                        </div>
                        <Select
                          value=""
                          onValueChange={(userId) => handleAssignClaim(claim.id, userId)}
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Assign to..." />
                          </SelectTrigger>
                          <SelectContent>
                            {users
                              .filter(u => u.role === 'adjuster' || u.role === 'siu_analyst')
                              .map((user) => (
                                <SelectItem key={user.user_id} value={user.user_id}>
                                  {user.full_name || user.email}
                                </SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Preferences Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <AdminNotificationPreferences />
            <AdminRoleDefaults />
            <AdminEmailLog />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
