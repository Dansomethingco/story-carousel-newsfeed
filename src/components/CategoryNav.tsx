import { Button } from "@/components/ui/button";

interface CategoryNavProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export const CategoryNav = ({ categories, activeCategory, onCategoryChange }: CategoryNavProps) => {
  return (
    <div className="flex justify-between w-full pb-2">
      {categories.map((category) => (
        <Button
          key={category}
          variant={activeCategory === category ? "default" : "secondary"}
          onClick={() => onCategoryChange(category)}
          className={`flex-1 px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
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