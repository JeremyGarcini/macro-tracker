"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { openai } from "@/lib/openai";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type UserSettings = {
  proteinPerMeal: string;
  fatPerMeal: string;
  carbsPerMeal: string;
  dietaryPreferences: string;
};

export default function HelpPage() {
  const [mealType, setMealType] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [previousRecipes, setPreviousRecipes] = useState<
    Record<string, Set<string>>
  >({
    breakfast: new Set(),
    lunch: new Set(),
    dinner: new Set(),
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadUserSettings();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadUserSettings = async () => {
    try {
      const settingsRef = doc(db, "settings", "user");
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        setUserSettings({
          proteinPerMeal: data.proteinPerMeal,
          fatPerMeal: data.fatPerMeal,
          carbsPerMeal: data.carbsPerMeal,
          dietaryPreferences: data.dietaryPreferences,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Error",
        description: "Failed to load meal plan settings",
        variant: "destructive",
      });
    }
  };

  const generateInitialPrompt = (selectedMeal: string) => {
    if (!userSettings) return "";

    const dietaryRestriction =
      userSettings.dietaryPreferences !== "none"
        ? `Ensure the recipe is **${userSettings.dietaryPreferences}**.`
        : "";

    return `You are a **culinary expert** crafting **creative, quick, and flavorful** ${selectedMeal.toLowerCase()} recipes that precisely match these macronutrient targets:
  
    - **Protein:** ${userSettings.proteinPerMeal}g  
    - **Fat:** ${userSettings.fatPerMeal}g  
    - **Carbs:** ${userSettings.carbsPerMeal}g  
    ${
      dietaryRestriction
        ? `- **Dietary Restriction:** ${dietaryRestriction}`
        : ""
    }
  
    **🚫 Prohibited ingredients:** Do **NOT** use quinoa. Instead, use alternative carbohydrate sources such as rice, potatoes, oats, or whole-grain pasta.
  
    Your recipe **must not repeat** any of the following previously suggested ones:  
    ${
      Array.from(Object.values(previousRecipes).flat()).join(", ") || "None yet"
    }
  
    🎯 **Your goal:**  
    - Avoid generic, boring, or common meal ideas.  
    - Think like a **Michelin-starred chef** who optimizes flavor, texture, and efficiency.  
    - Ensure prep time is **under 20 minutes**.  
  
    ### **Provide ONLY the following in Markdown format:**
  
    # [Recipe Name]  
  
    **Difficulty:** [Beginner / Intermediate / Advanced]  
  
    ## Ingredients  
    - [ingredient 1]  
    - [ingredient 2]  
    - ...  
  
    ## Quick Instructions  
    1. [Step 1]  
    2. [Step 2]  
    - Keep it **clear, concise, and efficient**.  
  
    ## Nutritional Information  
    - **Protein:** [amount]g  
    - **Fat:** [amount]g  
    - **Carbs:** [amount]g  
    - **Calories:** [amount]  
  
    **Important:** The recipe **must match** the exact macronutrient targets given above, with a max variance of ±2g. Double-check the values before finalizing.`;
  };

  const extractRecipeName = (content: string): string => {
    const match = content.match(/# (.*?)(\n|$)/);
    return match ? match[1].trim() : "";
  };

  const handleMealTypeChange = async (value: string) => {
    setMealType(value);
    setMessages([]);
    setPreviousRecipes({
      breakfast: new Set(),
      lunch: new Set(),
      dinner: new Set(),
    });

    if (!userSettings) {
      toast({
        title: "Warning",
        description: "Please set up your meal plan in settings first",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content:
              value === "Breakfast"
                ? `You are a master chef specializing in **exceptional ${value.toLowerCase()} recipes**. Your creations are flavorful, balanced, and exciting. Avoid generic or overly simplistic options—elevate classic breakfasts with unique ingredients, techniques, or unexpected twists. Format responses in markdown.`
                : `You are a world-class chef, known for crafting **incredible** ${value.toLowerCase()} recipes. Create **distinctive, restaurant-quality dishes** with creative ingredients and bold flavors. Avoid greetings and extra commentary. Format responses in markdown.`,
          },
          { role: "user", content: generateInitialPrompt(value) },
        ],
        temperature: 1.2, // Increase randomness for variety
      });

      const recipe = response.choices[0].message.content;
      if (recipe) {
        const recipeName = extractRecipeName(recipe);
        setPreviousRecipes((prev) => ({
          ...prev,
          [value.toLowerCase()]: new Set([
            ...prev[value.toLowerCase()],
            recipeName,
          ]),
        }));

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: recipe },
        ]);
      }
    } catch (error) {
      console.error("Error generating recipe:", error);
      toast({
        title: "Error",
        description: "Failed to generate recipe",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !mealType) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content:
              mealType === "Breakfast"
                ? "You are a **world-class breakfast chef**. Your recipes are unique, flavorful, and thoughtfully crafted. Keep responses focused on **delicious, high-quality breakfast ideas**, avoiding anything too plain or generic. Format responses in markdown."
                : `You are a **renowned chef specializing in ${mealType.toLowerCase()} cuisine**. Your recipes should be **bold, exciting, and inspired by top-tier culinary techniques**. Format responses in markdown.`,
          },
          ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
          { role: "user", content: userMessage },
        ],
      });

      const reply = response.choices[0].message.content;
      if (reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      }
    } catch (error) {
      console.error("Error getting response:", error);
      toast({
        title: "Error",
        description: "Failed to get response",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-6 w-6" />
              </Button>
            </Link>
            <h1 className="text-xl font-semibold">Recipe Assistant</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="p-4">
            <Select value={mealType} onValueChange={handleMealTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select Meal Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Breakfast">Breakfast</SelectItem>
                <SelectItem value="Lunch">Lunch</SelectItem>
                <SelectItem value="Dinner">Dinner</SelectItem>
              </SelectContent>
            </Select>
          </Card>

          {(mealType || messages.length > 0) && (
            <Card className="p-4">
              <div className="h-[500px] flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground ml-4"
                            : "bg-muted mr-4"
                        }`}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          className="prose prose-sm dark:prose-invert max-w-none"
                          components={{
                            h1: ({ node, ...props }) => (
                              <h1
                                className="text-xl font-bold mb-2"
                                {...props}
                              />
                            ),
                            h2: ({ node, ...props }) => (
                              <h2
                                className="text-lg font-semibold mt-4 mb-2"
                                {...props}
                              />
                            ),
                            h3: ({ node, ...props }) => (
                              <h3
                                className="text-md font-semibold mt-3 mb-1"
                                {...props}
                              />
                            ),
                            ul: ({ node, ...props }) => (
                              <ul className="list-disc pl-4 mb-2" {...props} />
                            ),
                            ol: ({ node, ...props }) => (
                              <ol
                                className="list-decimal pl-4 mb-2"
                                {...props}
                              />
                            ),
                            li: ({ node, ...props }) => (
                              <li className="mb-1" {...props} />
                            ),
                            p: ({ node, ...props }) => (
                              <p className="mb-2" {...props} />
                            ),
                            strong: ({ node, ...props }) => (
                              <strong className="font-semibold" {...props} />
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted max-w-[80%] rounded-lg p-3 mr-4">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      mealType
                        ? "Type your message..."
                        : "Select a meal type to start"
                    }
                    className="resize-none"
                    disabled={!mealType || isLoading}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={isLoading || !input.trim() || !mealType}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
