import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Shield, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Shield className="h-10 w-10 text-primary" />
          <span className="text-2xl font-bold text-foreground">ClaimGuard</span>
        </div>
        
        <h1 className="mb-3 text-6xl sm:text-7xl font-bold text-primary">404</h1>
        <h2 className="mb-2 text-xl sm:text-2xl font-semibold text-foreground">Page Not Found</h2>
        <p className="mb-6 text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/dashboard">
            <Button className="w-full sm:w-auto gap-2">
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Button>
          </Link>
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
            className="w-full sm:w-auto gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </div>
        
        <p className="mt-8 text-xs text-muted-foreground">
          ClaimGuard — Enterprise Claims Platform
        </p>
      </div>
    </div>
  );
};

export default NotFound;
