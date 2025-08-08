import { Footer } from "@/components/Footer";

const About = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <img 
              src="/lovable-uploads/c6389b85-0967-4d79-8532-74f1d53b31f7.png" 
              alt="Today" 
              className="h-12 md:h-16 w-auto object-contain"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            About Today
          </h1>
          
          <div className="prose prose-lg max-w-none text-foreground space-y-6">
            <p className="text-lg text-muted-foreground leading-relaxed">
              Today is your go-to source for the latest news across multiple categories including business, sports, politics, technology, and entertainment.
            </p>
            
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed">
                We believe in delivering timely, accurate, and comprehensive news coverage that keeps you informed about the world around you. Our platform aggregates the best content from trusted sources to provide you with a curated news experience.
              </p>
            </section>
            
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">What We Offer</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Real-time news updates from multiple categories</li>
                <li>Clean, intuitive interface for easy browsing</li>
                <li>Mobile-optimized experience with pull-to-refresh</li>
                <li>Curated content from trusted news sources</li>
                <li>Video content integration for rich media experience</li>
              </ul>
            </section>
            
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Stay Connected</h2>
              <p className="text-muted-foreground leading-relaxed">
                Keep up with the latest developments in your areas of interest. Whether you're following breaking news, sports updates, market trends, or technology innovations, Today brings you the stories that matter most.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default About;