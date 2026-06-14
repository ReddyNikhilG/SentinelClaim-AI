import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only trigger with Alt key combos to avoid conflicts
      if (!e.altKey || e.ctrlKey || e.metaKey) return;

      const key = e.key.toLowerCase();
      let handled = true;

      switch (key) {
        case 'd':
          navigate('/dashboard');
          break;
        case 'c':
          navigate('/claims');
          break;
        case 'n':
          navigate('/claims/new');
          break;
        case 'a':
          navigate('/analytics');
          break;
        case 's':
          navigate('/settings');
          break;
        case '?':
          toast({
            title: '⌨️ Keyboard Shortcuts',
            description: 'Alt+D: Dashboard | Alt+C: Claims | Alt+N: New Claim | Alt+A: Analytics | Alt+S: Settings',
          });
          break;
        default:
          handled = false;
      }

      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, toast]);
}
