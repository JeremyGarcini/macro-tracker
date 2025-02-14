"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import Link from "next/link";
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
import { useToast } from "@/hooks/use-toast";

type Food = {
  name: string;
  quantity: string;
  notes: string;
};

type Meal = {
  id: string;
  name: string;
  foods: Food[];
  image?: string;
  timestamp: number;
};

export default function CalendarPage() {
  const [date, setDate] = useState<Date>(new Date());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [mealToDelete, setMealToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadMeals();
  }, [date]);

  const loadMeals = async () => {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const mealsRef = collection(db, 'meals');
      const q = query(
        mealsRef,
        orderBy('timestamp', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const allMeals = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Meal[];

      const filteredMeals = allMeals.filter(meal => {
        const mealDate = new Date(meal.timestamp);
        return mealDate >= startOfDay && mealDate <= endOfDay;
      });

      setMeals(filteredMeals);
    } catch (error) {
      console.error('Error loading meals:', error);
      toast({
        title: "Error",
        description: "Failed to load meals",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMeal = async () => {
    if (!mealToDelete) return;

    try {
      await deleteDoc(doc(db, 'meals', mealToDelete));
      setMeals(meals.filter(meal => meal.id !== mealToDelete));
      toast({
        title: "Success",
        description: "Meal deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting meal:', error);
      toast({
        title: "Error",
        description: "Failed to delete meal",
        variant: "destructive",
      });
    } finally {
      setMealToDelete(null);
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
            <h1 className="text-xl font-semibold">Calendar</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Select Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={date}
                onSelect={(date) => date && setDate(date)}
                className="rounded-md border w-full"
              />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  Meals for {format(date, "MMMM d, yyyy")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {meals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No meals logged for this date
                  </div>
                ) : (
                  <div className="space-y-6">
                    {meals.map((meal) => (
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
                                <h3 className="font-medium">
                                  {meal.name}
                                </h3>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {format(new Date(meal.timestamp), "h:mm a")}
                                </p>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setMealToDelete(meal.id)}
                              >
                                Delete
                              </Button>
                            </div>
                            <ul className="space-y-1">
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
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <AlertDialog open={!!mealToDelete} onOpenChange={() => setMealToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this meal? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMeal}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}