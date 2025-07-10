import { useState, useEffect } from "react";
import { CategoryNav } from "./CategoryNav";
import { NewsCarousel } from "./NewsCarousel";
import newsHero from "@/assets/news-hero.jpg";
import sportsNews from "@/assets/sports-news.jpg";
import f1News from "@/assets/f1-news.jpg";
import politicsNews from "@/assets/politics-news.jpg";

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
    readTime: "3 min read"
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
    readTime: "4 min read"
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
    readTime: "5 min read"
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
    readTime: "6 min read"
  }
];

const categories = ["all", "sport", "politics", "technology", "music", "history"];

export const NewsApp = () => {
  const [articles, setArticles] = useState<NewsArticle[]>(mockArticles);
  const [activeCategory, setActiveCategory] = useState("all");
  const [filteredArticles, setFilteredArticles] = useState<NewsArticle[]>(mockArticles);

  useEffect(() => {
    if (activeCategory === "all") {
      setFilteredArticles(articles);
    } else {
      setFilteredArticles(articles.filter(article => article.category === activeCategory));
    }
  }, [activeCategory, articles]);

  // Simulate API call - you can replace this with actual API integration
  useEffect(() => {
    const fetchNews = async () => {
      // This is where you would typically make an API call
      // For now, we're using mock data
      console.log("Fetching news articles...");
      setArticles(mockArticles);
    };

    fetchNews();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-foreground">
              <span className="text-accent">T</span>oday
            </h1>
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
            onCategoryChange={setActiveCategory}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <NewsCarousel articles={filteredArticles} />
      </main>
    </div>
  );
};