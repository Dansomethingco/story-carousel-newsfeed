import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface FinanceSubcategoriesProps {
  activeSubcategory: string;
  onSubcategoryChange: (subcategory: string) => void;
}

const financeSubcategories = ["all", "stocks", "crypto", "business", "global trade"];

export const FinanceSubcategories = ({ activeSubcategory, onSubcategoryChange }: FinanceSubcategoriesProps) => {
  const getButtonStyle = (subcategory: string) => {
    if (activeSubcategory === subcategory) {
      return { backgroundColor: "#003366", color: "white" };
    }
    return {};
  };

  return (
    <div className="border-b border-border bg-background py-2">
      <div className="container mx-auto px-4 md:px-6">
        <ScrollArea className="w-full">
          <div className="flex space-x-2 pb-2 w-max">
            {financeSubcategories.map((subcategory) => (
              <Button
                key={subcategory}
                variant={activeSubcategory === subcategory ? "default" : "outline"}
                onClick={() => onSubcategoryChange(subcategory)}
                style={getButtonStyle(subcategory)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 capitalize whitespace-nowrap ${
                  activeSubcategory === subcategory
                    ? "" // Remove default styling when using custom colors
                    : "bg-background hover:bg-secondary/80 text-foreground border-border"
                }`}
              >
                {subcategory}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
};