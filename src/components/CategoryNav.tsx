import { Button } from "@/components/ui/button";

interface CategoryNavProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export const CategoryNav = ({ categories, activeCategory, onCategoryChange }: CategoryNavProps) => {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
      {categories.map((category) => (
        <Button
          key={category}
          variant={activeCategory === category ? "default" : "secondary"}
          onClick={() => onCategoryChange(category)}
          className={`whitespace-nowrap px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            activeCategory === category 
              ? "bg-primary text-primary-foreground" 
              : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
          }`}
        >
          {category}
        </Button>
      ))}
    </div>
  );
};