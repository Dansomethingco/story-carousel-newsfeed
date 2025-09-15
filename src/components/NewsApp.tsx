import { useState, useEffect } from "react";
import { CategoryNav } from "./CategoryNav";
import { FinanceSubcategories } from "./FinanceSubcategories";
import { FootballSubcategories } from "./FootballSubcategories";
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
import footballLogo from "@/assets/football-logo.svg";

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

// Mock data removed - using live news only

const categories = ["all", "finance", "football"];

export const NewsApp = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeFinanceSubcategory, setActiveFinanceSubcategory] = useState("all");
  const [activeFootballSubcategory, setActiveFootballSubcategory] = useState("all");
  const [filteredArticles, setFilteredArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isNative, triggerHaptic } = useCapacitor();

  useEffect(() => {
    // Articles are already category-specific when not on "all",
    // so just display the loaded set without re-filtering.
    setFilteredArticles(articles);
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
        
        if (activeCategory === "all") {
          // For "all" category, fetch from multiple categories and combine
          const categories = ["general", "business", "sports", "technology"];
          const allArticles: NewsArticle[] = [];
          
          for (const cat of categories) {
            try {
              const response = await supabase.functions.invoke('fetch-news', {
                body: { 
                  category: cat,
                  country: 'us',
                  pageSize: 5 // Get fewer from each category to have variety
                }
              });
              
              if (response.data?.articles) {
                allArticles.push(...response.data.articles);
              }
            } catch (error) {
              console.warn(`Failed to fetch ${cat} news:`, error);
            }
          }
          
          if (allArticles.length > 0) {
            // Shuffle and limit to 20 articles for variety
            const shuffled = allArticles.sort(() => Math.random() - 0.5).slice(0, 20);
            setArticles(shuffled);
            console.log(`Successfully loaded ${shuffled.length} articles from multiple categories`);
          } else {
            setArticles([]);
            toast({
              title: "Connection error",
              description: "Unable to fetch latest news. Please try again.",
              variant: "destructive",
            });
          }
        } else if (activeCategory === "finance" && activeFinanceSubcategory === "all") {
          // For finance "all", fetch from each subcategory and combine
          const financeSubcategories = ["stocks", "crypto", "business", "global trade"];
          const allFinanceArticles: NewsArticle[] = [];
          
          for (const subcat of financeSubcategories) {
            try {
              let searchQuery = "";
              switch (subcat) {
                case "stocks":
                  searchQuery = "stocks OR shares OR equity OR \"stock market\" OR NYSE OR NASDAQ OR \"S&P 500\" OR \"Dow Jones\" OR indices OR trading OR CFDs";
                  break;
                case "crypto":
                  searchQuery = "cryptocurrency OR bitcoin OR ethereum OR crypto OR blockchain OR \"digital currency\" OR \"crypto trading\"";
                  break;
                case "business":
                  searchQuery = "business OR corporate OR company OR enterprise OR earnings OR revenue OR \"quarterly results\" OR IPO OR merger";
                  break;
                case "global trade":
                  searchQuery = "trade OR import OR export OR tariff OR \"international trade\" OR \"global commerce\" OR \"trade deals\"";
                  break;
              }
              
              const response = await supabase.functions.invoke('fetch-news', {
                body: { 
                  category: "business",
                  country: 'us',
                  pageSize: 5,
                  searchQuery
                }
              });
              
              if (response.data?.articles) {
                allFinanceArticles.push(...response.data.articles);
              }
            } catch (error) {
              console.warn(`Failed to fetch ${subcat} finance news:`, error);
            }
          }
          
          if (allFinanceArticles.length > 0) {
            // Remove duplicates and shuffle
            const uniqueArticles = allFinanceArticles.filter((article, index, self) => 
              index === self.findIndex(a => a.title === article.title)
            );
            const shuffled = uniqueArticles.sort(() => Math.random() - 0.5).slice(0, 20);
            setArticles(shuffled);
            console.log(`Successfully loaded ${shuffled.length} finance articles from all subcategories`);
          } else {
            setArticles([]);
            toast({
              title: "Connection error",
              description: "Unable to fetch finance news. Please try again.",
              variant: "destructive",
            });
          }
        } else {
          // For specific categories
          let category = activeCategory === "football" ? "sports" : 
                        activeCategory === "finance" ? "business" : 
                        activeCategory;
          
          // Handle subcategories
          let searchQuery = "";
          if (activeCategory === "finance") {
            category = "business"; // Keep using business for API
            if (activeFinanceSubcategory !== "all") {
              switch (activeFinanceSubcategory) {
                case "stocks":
                  searchQuery = "stocks OR shares OR equity OR \"stock market\" OR NYSE OR NASDAQ OR \"S&P 500\" OR \"Dow Jones\" OR indices OR trading OR CFDs OR \"futures market\" OR \"options trading\" OR \"market volatility\" OR \"bull market\" OR \"bear market\"";
                  break;
                case "crypto":
                  searchQuery = "cryptocurrency OR bitcoin OR ethereum OR crypto OR blockchain OR \"digital currency\" OR \"crypto trading\" OR altcoin OR \"DeFi\" OR \"NFT\" OR \"Web3\" OR \"crypto market\" OR \"bitcoin price\" OR \"ethereum price\"";
                  break;
                case "business":
                  searchQuery = "business OR corporate OR company OR enterprise OR earnings OR revenue OR \"quarterly results\" OR IPO OR merger OR acquisition OR \"business news\" OR CEO OR \"corporate strategy\" OR startup OR \"market share\"";
                  break;
                case "global trade":
                  searchQuery = "trade OR import OR export OR tariff OR \"international trade\" OR \"global commerce\" OR \"trade deals\" OR \"trade war\" OR \"supply chain\" OR \"trade agreement\" OR \"customs\" OR \"trade deficit\" OR \"trade surplus\"";
                  break;
              }
            }
          } else if (activeCategory === "football" && activeFootballSubcategory !== "all") {
            category = "sports"; // Keep using sports for API
            switch (activeFootballSubcategory) {
              case "my team":
                searchQuery = "football OR soccer OR team OR club OR match OR league";
                break;
              case "premier league":
                searchQuery = "Premier League OR EPL OR English football OR Manchester OR Arsenal OR Chelsea OR Liverpool";
                break;
              case "uefa":
                searchQuery = "UEFA OR Champions League OR Europa League OR European football OR UCL";
                break;
              case "international":
                searchQuery = "FIFA OR World Cup OR international football OR national team OR Euro OR Copa America";
                break;
            }
          }
          
          const response = await supabase.functions.invoke('fetch-news', {
            body: { 
              category: category,
              country: 'us',
              pageSize: 20,
              ...(searchQuery && { searchQuery })
            }
          });

          if (response.error) {
            throw new Error(response.error.message || 'Failed to fetch news');
          }

          const data = response.data;
          
          if (data.articles && data.articles.length > 0) {
            setArticles(data.articles);
            console.log(`Successfully loaded ${data.articles.length} articles for ${activeCategory}`);
          } else {
            setArticles([]);
            toast({
              title: "No articles found",
              description: "No news articles available for this category. Please try again later.",
              variant: "destructive",
            });
          }
        }
        
      } catch (error) {
        console.error('Error calling edge function:', error);
        toast({
          title: "Connection error",
          description: "Unable to fetch latest news. Please check your connection and try again.",
          variant: "destructive",
        });
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchNews();
  }, [activeCategory, activeFinanceSubcategory, activeFootballSubcategory, toast]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <img 
              src={
                activeCategory === "finance" ? financeLogo : 
                activeCategory === "football" ? footballLogo :
                "/lovable-uploads/c6389b85-0967-4d79-8532-74f1d53b31f7.png"
              }
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
              // Reset subcategories when changing main categories
              if (category !== "finance") {
                setActiveFinanceSubcategory("all");
              }
              if (category !== "football") {
                setActiveFootballSubcategory("all");
              }
            }}
          />
        </div>
      </header>

      {/* Finance Subcategories */}
      {activeCategory === "finance" && (
        <FinanceSubcategories 
          activeSubcategory={activeFinanceSubcategory}
          onSubcategoryChange={(subcategory) => {
            triggerHaptic();
            setActiveFinanceSubcategory(subcategory);
          }}
        />
      )}

      {/* Football Subcategories */}
      {activeCategory === "football" && (
        <FootballSubcategories 
          activeSubcategory={activeFootballSubcategory}
          onSubcategoryChange={(subcategory) => {
            triggerHaptic();
            setActiveFootballSubcategory(subcategory);
          }}
        />
      )}

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
