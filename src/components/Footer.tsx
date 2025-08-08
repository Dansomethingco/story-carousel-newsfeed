import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="container mx-auto px-4 md:px-6 py-6">
        {/* Main footer content */}
        <div className="flex items-center justify-between mb-4">
          {/* Logo */}
          <img 
            src="/lovable-uploads/c6389b85-0967-4d79-8532-74f1d53b31f7.png" 
            alt="Today" 
            className="h-8 w-auto object-contain"
          />
          
          {/* Navigation links */}
          <nav className="flex items-center space-x-6">
            <Link 
              to="/" 
              className="text-foreground hover:text-accent transition-colors font-medium"
            >
              feed
            </Link>
            <Link 
              to="/about" 
              className="text-foreground hover:text-accent transition-colors font-medium"
            >
              about
            </Link>
          </nav>
        </div>
        
        {/* Copyright */}
        <div className="text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} somethingco. All rights reserved. Unauthorized reproduction or distribution of this content is strictly prohibited.
        </div>
      </div>
    </footer>
  );
};