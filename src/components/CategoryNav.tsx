import { Button } from "@/components/ui/button";

interface CategoryNavProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export const CategoryNav = ({ categories, activeCategory, onCategoryChange }: CategoryNavProps) => {
  const getButtonStyle = (category: string) => {
    if (activeCategory === category) {
      if (category === "finance") {
        return { backgroundColor: "#003366", color: "white" };
      }
      if (category === "football") {
        return { backgroundColor: "#44e51b", color: "white" };
      }
    }
    return {};
  };

  return (
    <div className="flex justify-between gap-3 w-full pb-2">
      {categories.map((category) => (
        <Button
          key={category}
          variant={activeCategory === category ? "default" : "secondary"}
          onClick={() => onCategoryChange(category)}
          style={getButtonStyle(category)}
          className={`flex-1 px-6 py-2 rounded-full text-base font-medium transition-all duration-200 ${
            activeCategory === category && (category === "finance" || category === "football")
              ? "" // Remove default styling when using custom colors
              : activeCategory === category 
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