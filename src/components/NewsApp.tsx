import { useState, useEffect } from "react";
import { CategoryNav } from "./CategoryNav";
import { NewsCarousel } from "./NewsCarousel";
import { SignupPopup } from "./SignupPopup";
import { PullToRefresh } from "./PullToRefresh";
import { Footer } from "./Footer";
import { Button } from "@/components/ui/button";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCapacitor } from "@/hooks/useMobile";
import { StatusBar, Style } from '@capacitor/status-bar';
import newsHero from "@/assets/news-hero.jpg";
import sportsNews from "@/assets/sports-news.jpg";
import f1News from "@/assets/f1-news.jpg";
import politicsNews from "@/assets/politics-news.jpg";
import financeLogo from "@/assets/finance-logo.svg";

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  image: string;
  source: string;
  category: string;
  publishedAt: string;
  readTime: string;
  isVideo?: boolean;
  videoId?: string;
  embedUrl?: string;
  videoThumbnail?: string;
}

// Mock data - in a real app this would come from an API
const mockArticles: NewsArticle[] = [
  {
    id: "1",
    title: "Sam Cook earns maiden England call up as Zak Crawley retains spot for Zimbabwe Test match",
    summary: "Nottinghamshire fast bowler Josh Tongue in line for a first England cap in two years after injury troubles; Shoaib Bashir retains role as front-line spinner over Jack Leach; England face Zimbabwe in one-off Test at Trent Bridge, live on Sky Sports from May 22-25",
    content: "Cook's call up is reward for years of consistent performances on the county circuit for a number of years, averaging 19.77 with the ball. He joins Gus Atkinson, Matthew Potts and Josh Tongue as the team's pace options for England captain Ben Stokes at Trent Bridge from May 22, with Stokes himself fit to feature after having surgery on the hamstring before the third Test of England's series win in New Zealand. Nottinghamshire fast bowler Tongue is in line to play his first Test in two years after injuries stalled a promising start and limited his involvement which included a five-for on debut against Ireland and five more wickets across four Tests against Australia at Lord's in 2023.",
    image: sportsNews,
    source: "Sky Sports",
    category: "sport",
    publishedAt: "2025-07-10T13:00:00Z",
    readTime: "3 min read",
    isVideo: false
  },
  {
    id: "2",
    title: "Five things to know before Miami Grand Prix",
    summary: "BBC Sport's Harry Benjamin looks ahead to the Miami Grand Prix and the five things to look out for over the race weekend.",
    content: "The Miami Grand Prix returns for another exciting weekend of Formula 1 racing. With the championship battle heating up, all eyes will be on the key contenders as they navigate the challenging street circuit. The weather conditions are expected to play a crucial role, with potential for rain adding an extra element of unpredictability to the race. Teams have been working tirelessly on their setups to find the perfect balance between speed and reliability on this unique track layout.",
    image: f1News,
    source: "BBC Sport",
    category: "sport",
    publishedAt: "2025-07-10T08:00:00Z",
    readTime: "4 min read",
    isVideo: false
  },
  {
    id: "3",
    title: "Government Announces New Economic Recovery Package",
    summary: "A comprehensive economic stimulus package aimed at supporting businesses and workers affected by recent market volatility has been unveiled by government officials.",
    content: "The new economic recovery package includes targeted support for small businesses, extended unemployment benefits, and infrastructure investment programs. The announcement comes as policymakers work to address ongoing economic challenges and support sustainable growth. Key measures include tax relief for businesses, funding for green technology initiatives, and support for skills training programs to help workers adapt to changing market conditions.",
    image: politicsNews,
    source: "Government News",
    category: "politics",
    publishedAt: "2025-07-10T10:30:00Z",
    readTime: "5 min read",
    isVideo: false
  },
  {
    id: "4",
    title: "Breaking: Major Technology Breakthrough Announced",
    summary: "Scientists have achieved a significant breakthrough in quantum computing that could revolutionize multiple industries and accelerate technological advancement.",
    content: "The breakthrough represents years of research and development in quantum computing technology. Experts believe this advancement could have far-reaching implications for cybersecurity, drug discovery, and artificial intelligence. The research team has successfully demonstrated quantum advantage in practical applications, marking a crucial milestone in the field. Industry leaders are already exploring potential applications and partnerships to bring this technology to market.",
    image: newsHero,
    source: "Tech News Daily",
    category: "technology",
    publishedAt: "2025-07-10T12:00:00Z",
    readTime: "6 min read",
    isVideo: false
  }
];

const categories = ["all", "finance", "sport"];

export const NewsApp = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [filteredArticles, setFilteredArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isNative, triggerHaptic } = useCapacitor();

  useEffect(() => {
    if (activeCategory === "all") {
      setFilteredArticles(articles);
    } else {
      setFilteredArticles(articles.filter(article => article.category === activeCategory));
    }
  }, [activeCategory, articles]);

  // Configure status bar for mobile
  useEffect(() => {
    if (isNative) {
      StatusBar.setStyle({ style: Style.Light });
    }
  }, [isNative]);

  // Fetch news from unified endpoint that combines all sources including YouTube
  const fetchNews = async () => {
      try {
        setLoading(true);
        
        const category = activeCategory === "all" ? "general" : activeCategory;
        
        // Call unified fetch-news endpoint
        const response = await supabase.functions.invoke('fetch-news', {
          body: { 
            category: category,
            country: 'us',
            pageSize: 20
          }
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to fetch news');
        }

        const data = response.data;
        
        if (data.articles && data.articles.length > 0) {
          setArticles(data.articles);
          console.log(`Successfully loaded ${data.articles.length} articles (mixed sources including YouTube)`);
        } else {
          // Fallback to mock data if no articles received
          console.warn('No articles received from API, using mock data');
          toast({
            title: "Connection error",
            description: "Unable to fetch latest news. Using cached articles.",
            variant: "destructive",
          });
          setArticles(mockArticles);
        }
        
      } catch (error) {
        console.error('Error calling edge function:', error);
        toast({
          title: "Connection error",
          description: "Unable to fetch latest news. Using cached articles.",
          variant: "destructive",
        });
        // Fallback to mock data
        setArticles(mockArticles);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchNews();
  }, [activeCategory, toast]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <img 
              src={activeCategory === "finance" ? financeLogo : "/lovable-uploads/c6389b85-0967-4d79-8532-74f1d53b31f7.png"}
              alt="Today" 
              className="h-12 md:h-16 w-auto object-contain"
            />
            <div className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-GB', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
          
          <CategoryNav 
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={(category) => {
              triggerHaptic();
              setActiveCategory(category);
            }}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <PullToRefresh onRefresh={fetchNews}>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-muted-foreground">Loading latest news...</div>
            </div>
          ) : (
            <NewsCarousel articles={filteredArticles} />
          )}
        </PullToRefresh>
      </main>

      {/* Signup Popup */}
      <SignupPopup />
      
      <Footer />
    </div>
  );
};
