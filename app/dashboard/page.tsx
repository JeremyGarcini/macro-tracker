"use client";

import { useState, useEffect } from "react";
import {
  Menu,
  Plus,
  Upload,
  X,
  MoreVertical,
  Pencil,
  Trash,
  CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { openai } from "@/lib/openai";
import Link from "next/link";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRouter } from "next/navigation";

type Food = {
  name: string;
  quantity: string;
  notes: string;
};

type Meal = {
  id: string;
  name: string;
  foods: Food[];
  image?: string | null;
  timestamp: number;
  category: string;
};

type MealCategory = {
  title: string;
  meals: Meal[];
};

const MAX_IMAGE_SIZE = 800;

const resizeImage = (dataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_IMAGE_SIZE) {
          height = Math.round((height * MAX_IMAGE_SIZE) / width);
          width = MAX_IMAGE_SIZE;
        }
      } else {
        if (height > MAX_IMAGE_SIZE) {
          width = Math.round((width * MAX_IMAGE_SIZE) / height);
          height = MAX_IMAGE_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
};

export default function Dashboard() {
  const router = useRouter();
  const [accessLevel, setAccessLevel] = useState<"basic" | "full" | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [mealCategories, setMealCategories] = useState<MealCategory[]>([
    { title: "Breakfast", meals: [] },
    { title: "Lunch", meals: [] },
    { title: "Dinner", meals: [] },
    { title: "Snack 1", meals: [] },
    { title: "Snack 2", meals: [] },
  ]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<"upload" | "edit">("upload");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mealToDelete, setMealToDelete] = useState<string | null>(null);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check access level on component mount
    const storedAccess = localStorage.getItem("accessLevel") as
      | "basic"
      | "full"
      | null;
    if (!storedAccess) {
      router.push("/");
      return;
    }
    setAccessLevel(storedAccess);
    loadMeals();
  }, [router]);

  const loadMeals = async () => {
    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const mealsRef = collection(db, "meals");
      const q = query(
        mealsRef,
        where("timestamp", ">=", startOfDay.getTime()),
        where("timestamp", "<=", endOfDay.getTime()),
        orderBy("timestamp", "asc")
      );

      const querySnapshot = await getDocs(q);
      const meals = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Meal[];

      const updatedCategories = [...mealCategories];
      updatedCategories.forEach((category) => {
        category.meals = [];
      });

      meals.forEach((meal) => {
        const categoryIndex = mealCategories.findIndex(
          (cat) => cat.title === meal.category
        );
        if (categoryIndex !== -1) {
          updatedCategories[categoryIndex].meals.push(meal);
        }
      });

      setMealCategories(updatedCategories);
    } catch (error) {
      console.error("Error loading meals:", error);
      toast({
        title: "Error",
        description: "Failed to load meals",
        variant: "destructive",
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const resizedImage = await resizeImage(reader.result as string);
          setSelectedImage(resizedImage);
          setIsAnalyzing(true);

          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini-2024-07-18",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyze the given food image and identify the items along with their approximate quantities. Format each entry as 'Food Name|||Quantity' without any leading dashes or special characters. For example: 'Grilled chicken|||3 pieces'.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: resizedImage,
                      detail: "low",
                    },
                  },
                ],
              },
            ],
            max_tokens: 500,
          });

          const analysis = response.choices[0].message.content;
          if (analysis) {
            const detectedFoods = analysis
              .split("\n")
              .filter((line) => line.trim())
              .map((line) => {
                const [name, quantity] = line.split("|||").map((s) => s.trim());
                return {
                  name: name || "",
                  quantity: quantity || "1 serving",
                  notes: "",
                };
              });
            setFoods(detectedFoods);
          }
          setCurrentStep("edit");
        } catch (error) {
          console.error("Error analyzing image:", error);
          toast({
            title: "Error",
            description: "Failed to analyze image",
            variant: "destructive",
          });
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddMeal = async () => {
    if (selectedCategory === null) return;

    try {
      const timestamp = selectedDate.getTime();
      const mealData = {
        name: `${mealCategories[selectedCategory].title} - ${format(
          selectedDate,
          "h:mm a"
        )}`,
        foods: foods,
        image: selectedImage,
        timestamp: timestamp,
        category: mealCategories[selectedCategory].title,
      };

      const docRef = await addDoc(collection(db, "meals"), mealData);
      const newMeal: Meal = {
        id: docRef.id,
        ...mealData,
      };

      const updatedCategories = [...mealCategories];
      updatedCategories[selectedCategory].meals = [
        ...updatedCategories[selectedCategory].meals,
        newMeal,
      ];

      setMealCategories(updatedCategories);
      resetModal();
      toast({
        title: "Success",
        description: "Meal added successfully",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error adding meal:", error);
      toast({
        title: "Error",
        description: "Failed to save meal",
        variant: "destructive",
      });
    }
  };

  const handleEditMeal = async () => {
    if (!editingMeal) return;

    try {
      const mealRef = doc(db, "meals", editingMeal.id);
      await updateDoc(mealRef, {
        foods: foods,
        image: selectedImage,
      });

      await loadMeals();
      resetModal();
      toast({
        title: "Success",
        description: "Meal updated successfully",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error updating meal:", error);
      toast({
        title: "Error",
        description: "Failed to update meal",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMeal = async () => {
    if (!mealToDelete) return;

    try {
      await deleteDoc(doc(db, "meals", mealToDelete));
      await loadMeals();
      toast({
        title: "Success",
        description: "Meal deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting meal:", error);
      toast({
        title: "Error",
        description: "Failed to delete meal",
        variant: "destructive",
      });
    } finally {
      setMealToDelete(null);
    }
  };

  const startEditingMeal = (meal: Meal) => {
    setEditingMeal(meal);
    setFoods(meal.foods);
    setSelectedImage(meal.image || null);
    setCurrentStep("edit");
    setIsModalOpen(true);
  };

  const resetModal = () => {
    setIsModalOpen(false);
    setCurrentStep("upload");
    setSelectedImage(null);
    setFoods([]);
    setSelectedCategory(null);
    setEditingMeal(null);
  };

  const handleAddFood = () => {
    setFoods([...foods, { name: "", quantity: "", notes: "" }]);
  };

  const updateFood = (index: number, field: keyof Food, value: string) => {
    const updatedFoods = [...foods];
    updatedFoods[index] = { ...updatedFoods[index], [field]: value };
    setFoods(updatedFoods);
  };

  const removeFood = (index: number) => {
    setFoods(foods.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <ScrollArea className="h-full py-4">
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Menu</h2>
                    <nav className="space-y-2">
                      <Link href="/dashboard">
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                        >
                          Dashboard
                        </Button>
                      </Link>
                      <Link href="/calendar">
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                        >
                          Calendar
                        </Button>
                      </Link>
                      {accessLevel === "full" && (
                        <>
                          <Link href="/progress">
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                            >
                              Progress
                            </Button>
                          </Link>
                          <Link href="/help">
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                            >
                              Recipe Assistant
                            </Button>
                          </Link>
                          <Link href="/settings">
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                            >
                              Settings
                            </Button>
                          </Link>
                        </>
                      )}
                    </nav>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="justify-center text-left font-normal w-[240px]"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "EEEE, MMMM d")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <div className="w-10" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {mealCategories.map((category, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-semibold">
                {category.title}
              </CardTitle>
              {accessLevel === "full" && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setSelectedCategory(index);
                    setIsModalOpen(true);
                  }}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {category.meals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No meals logged yet
                </div>
              ) : (
                <div className="space-y-4">
                  {category.meals.map((meal) => (
                    <div key={meal.id} className="border rounded-lg p-4">
                      <div className="flex gap-4">
                        {meal.image && (
                          <img
                            src={meal.image}
                            alt="Meal"
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium">{meal.name}</h3>
                              <ul className="mt-2 space-y-1">
                                {meal.foods.map((food, idx) => (
                                  <li
                                    key={idx}
                                    className="text-sm text-muted-foreground"
                                  >
                                    {food.name} - {food.quantity}
                                    {food.notes && ` (${food.notes})`}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            {accessLevel === "full" && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => startEditingMeal(meal)}
                                  >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setMealToDelete(meal.id)}
                                  >
                                    <Trash className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </main>

      <Dialog open={isModalOpen} onOpenChange={resetModal}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMeal
                ? "Edit Meal"
                : currentStep === "upload"
                ? "Upload Meal Image"
                : "Add Meal Details"}
            </DialogTitle>
          </DialogHeader>

          {currentStep === "upload" && !editingMeal ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-full max-w-sm">
                  {selectedImage ? (
                    <div className="relative">
                      <img
                        src={selectedImage}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => setSelectedImage(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Label
                      htmlFor="image-upload"
                      className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Click to upload image
                        </p>
                      </div>
                      <Input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </Label>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {foods.map((food, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Food Item {index + 1}</Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFood(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Food name"
                    value={food.name}
                    onChange={(e) => updateFood(index, "name", e.target.value)}
                  />
                  <Input
                    placeholder="Quantity"
                    value={food.quantity}
                    onChange={(e) =>
                      updateFood(index, "quantity", e.target.value)
                    }
                  />
                  <Textarea
                    placeholder="Notes"
                    value={food.notes}
                    onChange={(e) => updateFood(index, "notes", e.target.value)}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleAddFood}
              >
                Add Another Food Item
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                if (currentStep === "upload" && selectedImage) {
                  setCurrentStep("edit");
                } else if (currentStep === "edit") {
                  editingMeal ? handleEditMeal() : handleAddMeal();
                }
              }}
              disabled={
                (currentStep === "upload" && !selectedImage) || isAnalyzing
              }
            >
              {isAnalyzing
                ? "Analyzing..."
                : currentStep === "upload"
                ? "Analyze Image"
                : editingMeal
                ? "Save Changes"
                : "Save Meal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!mealToDelete}
        onOpenChange={() => setMealToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this meal? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMeal}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
