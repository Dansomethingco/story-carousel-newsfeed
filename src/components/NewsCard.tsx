
import { Badge } from "@/components/ui/badge";
import { Clock, Play, X } from "lucide-react";
import { useState } from "react";

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

interface NewsCardProps {
  article: NewsArticle;
}

export const NewsCard = ({ article }: NewsCardProps) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const handleVideoClick = () => {
    if (article.isVideo && article.embedUrl) {
      setIsVideoPlaying(true);
    }
  };

  const handleCloseVideo = () => {
    setIsVideoPlaying(false);
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
            {article.isVideo && (
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                Video
              </Badge>
            )}
            <span className="text-muted-foreground text-sm">
              {formatTime(article.publishedAt)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            <Clock className="w-4 h-4" />
            <span>{article.readTime}</span>
          </div>
        </div>

        {/* Article Image or Video Player - Only render if image exists or it's a video */}
        {(article.image || article.videoThumbnail || article.isVideo) && (
          <div className="mb-6 rounded-lg overflow-hidden bg-muted relative">
            {isVideoPlaying && article.isVideo && article.embedUrl ? (
              <div className="relative">
                <iframe
                  src={article.embedUrl}
                  title={article.title}
                  className="w-full h-48 md:h-64 aspect-video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
                <button
                  onClick={handleCloseVideo}
                  className="absolute top-2 right-2 bg-black/70 hover:bg-black/90 text-white rounded-full p-2 transition-colors"
                  aria-label="Close video"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="cursor-pointer" onClick={handleVideoClick}>
                <img 
                  src={article.videoThumbnail || article.image} 
                  alt={article.title}
                  className="w-full h-48 md:h-64 object-cover"
                  loading="lazy"
                />
                {article.isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
                    <div className="bg-red-600 hover:bg-red-700 rounded-full p-4 transition-colors">
                      <Play className="w-8 h-8 text-white fill-white" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        {article.summary && (
          <p className="text-muted-foreground leading-relaxed text-base md:text-lg mb-4">
            {article.summary}
          </p>
        )}

        {/* Content Preview */}
        <div className="text-foreground leading-relaxed text-sm md:text-base line-clamp-6">
          {article.content}
        </div>
      </div>
    </div>
  );
};
