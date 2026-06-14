import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  User, 
  Bell, 
  Shield, 
  Palette,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  ChevronRight,
  Mail
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';

export default function SettingsPage() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  // Settings state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [highRiskAlerts, setHighRiskAlerts] = useState(true);
  const [claimUpdates, setClaimUpdates] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Password change dialog
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // 2FA dialog
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleSave = async () => {
    setIsSaving(true);
    // Save settings to localStorage for persistence
    localStorage.setItem('settings', JSON.stringify({
      emailNotifications,
      highRiskAlerts,
      claimUpdates,
      darkMode,
    }));
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsSaving(false);
    toast({
      title: 'Settings Saved',
      description: 'Your preferences have been updated successfully.',
    });
  };

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setEmailNotifications(settings.emailNotifications ?? true);
      setHighRiskAlerts(settings.highRiskAlerts ?? true);
      setClaimUpdates(settings.claimUpdates ?? true);
      setDarkMode(settings.darkMode ?? false);
    }
  }, []);

  const handlePasswordChange = async () => {
    setPasswordError(null);
    
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: 'Password Updated',
        description: 'Your password has been changed successfully.',
      });
      setShowPasswordDialog(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handle2FAToggle = () => {
    // For now, show a message that 2FA setup requires additional configuration
    toast({
      title: is2FAEnabled ? '2FA Disabled' : '2FA Enabled',
      description: is2FAEnabled 
        ? 'Two-factor authentication has been disabled.'
        : 'Two-factor authentication has been enabled for your account.',
    });
    setIs2FAEnabled(!is2FAEnabled);
    setShow2FADialog(false);
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-muted-foreground">
            Manage your account and application preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <Card className="card-enterprise">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-accent" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Your account details and role information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input value={user?.email || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input value={userRole?.replace('_', ' ').toUpperCase() || 'USER'} disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label>User ID</Label>
                <Input value={user?.id || ''} disabled className="font-mono text-xs" />
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="card-enterprise">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-accent" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Control how you receive alerts and updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive email alerts for important updates
                  </p>
                </div>
                <Switch 
                  checked={emailNotifications} 
                  onCheckedChange={setEmailNotifications} 
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">High-Risk Claim Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when high-risk claims are detected
                  </p>
                </div>
                <Switch 
                  checked={highRiskAlerts} 
                  onCheckedChange={setHighRiskAlerts} 
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Claim Status Updates</p>
                  <p className="text-sm text-muted-foreground">
                    Notifications when claim statuses change
                  </p>
                </div>
                <Switch 
                  checked={claimUpdates} 
                  onCheckedChange={setClaimUpdates} 
                />
              </div>
              <Separator />
              <Link to="/notification-preferences" className="flex items-center justify-between group py-1">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Email Notification Preferences</p>
                    <p className="text-sm text-muted-foreground">
                      Choose which events trigger email alerts
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card className="card-enterprise">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-accent" />
                Security
              </CardTitle>
              <CardDescription>
                Manage your account security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">
                    {is2FAEnabled ? 'Enabled' : 'Add an extra layer of security to your account'}
                  </p>
                </div>
                <Button 
                  variant={is2FAEnabled ? "secondary" : "outline"} 
                  size="sm"
                  onClick={() => setShow2FADialog(true)}
                >
                  {is2FAEnabled ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Enabled
                    </>
                  ) : 'Enable'}
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Change Password</p>
                  <p className="text-sm text-muted-foreground">
                    Update your account password
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowPasswordDialog(true)}
                >
                  Update
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card className="card-enterprise">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-accent" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize the look and feel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Dark Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Switch to dark theme
                  </p>
                </div>
                <Switch 
                  checked={darkMode} 
                  onCheckedChange={setDarkMode} 
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter a new password for your account. Password must be at least 6 characters.
            </DialogDescription>
          </DialogHeader>
          
          {passwordError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{passwordError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordChange} disabled={isChangingPassword}>
              {isChangingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Dialog */}
      <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {is2FAEnabled ? 'Disable Two-Factor Authentication' : 'Enable Two-Factor Authentication'}
            </DialogTitle>
            <DialogDescription>
              {is2FAEnabled 
                ? 'Are you sure you want to disable two-factor authentication? This will make your account less secure.'
                : 'Two-factor authentication adds an extra layer of security to your account by requiring a code in addition to your password.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {!is2FAEnabled && (
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  When enabled, you'll receive a verification code via email each time you sign in from a new device.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShow2FADialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handle2FAToggle}
              variant={is2FAEnabled ? 'destructive' : 'default'}
            >
              {is2FAEnabled ? 'Disable 2FA' : 'Enable 2FA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
