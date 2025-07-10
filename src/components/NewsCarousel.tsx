import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewsCard } from "./NewsCard";

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

interface NewsCarouselProps {
  articles: NewsArticle[];
}

export const NewsCarousel = ({ articles }: NewsCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToArticle = (index: number) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const articleWidth = container.scrollWidth / articles.length;
      container.scrollTo({
        left: articleWidth * index,
        behavior: 'smooth'
      });
      setCurrentIndex(index);
    }
  };

  const nextArticle = () => {
    const nextIndex = (currentIndex + 1) % articles.length;
    scrollToArticle(nextIndex);
  };

  const prevArticle = () => {
    const prevIndex = currentIndex === 0 ? articles.length - 1 : currentIndex - 1;
    scrollToArticle(prevIndex);
  };

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const articleWidth = container.scrollWidth / articles.length;
        const newIndex = Math.round(container.scrollLeft / articleWidth);
        setCurrentIndex(newIndex);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [articles.length]);

  if (articles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">No articles available</p>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      {/* Navigation Buttons */}
      <Button
        variant="outline"
        size="icon"
        onClick={prevArticle}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/80 backdrop-blur-sm border-border hover:bg-background"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      
      <Button
        variant="outline"
        size="icon"
        onClick={nextArticle}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/80 backdrop-blur-sm border-border hover:bg-background"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>

      {/* Articles Container */}
      <div
        ref={scrollContainerRef}
        className="flex overflow-x-auto scrollbar-hide snap-x h-full"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {articles.map((article) => (
          <div key={article.id} className="w-full flex-shrink-0">
            <NewsCard article={article} />
          </div>
        ))}
      </div>

      {/* Dots Indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {articles.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollToArticle(index)}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              index === currentIndex 
                ? "bg-accent w-6" 
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
};