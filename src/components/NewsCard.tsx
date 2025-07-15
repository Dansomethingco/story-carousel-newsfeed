import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

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

interface NewsCardProps {
  article: NewsArticle;
}

export const NewsCard = ({ article }: NewsCardProps) => {
  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-background p-6 snap-start">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Title */}
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight mb-4 text-foreground">
          {article.title}
        </h1>

        {/* Source and Time Info */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-accent font-semibold text-sm bg-accent/10 px-3 py-1 rounded-full">
              {article.source}
            </span>
            <span className="text-muted-foreground text-sm">
              {formatTime(article.publishedAt)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            <Clock className="w-4 h-4" />
            <span>{article.readTime}</span>
          </div>
        </div>

        {/* Article Image */}
        <div className="mb-6 rounded-lg overflow-hidden bg-muted">
          <img 
            src={article.image} 
            alt={article.title}
            className="w-full h-48 md:h-64 object-cover"
            loading="lazy"
          />
        </div>

        {/* Summary */}
        <p className="text-muted-foreground leading-relaxed text-base md:text-lg mb-4">
          {article.summary}
        </p>

        {/* Content Preview */}
        <div className="text-foreground leading-relaxed text-sm md:text-base line-clamp-6">
          {article.content}
        </div>
      </div>
    </div>
  );
};