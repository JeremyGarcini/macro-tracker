"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Link from "next/link";

type UserSettings = {
  height: string;
  weight: string;
  calorieGoal: string;
  dietaryPreferences: string;
  measurementUnit: string;
  mealsPerDay: string;
  proteinPerMeal: string;
  fatPerMeal: string;
  carbsPerMeal: string;
  snacksPerDay: string;
  proteinPerSnack: string;
  fatPerSnack: string;
  carbsPerSnack: string;
};

const defaultSettings: UserSettings = {
  height: "",
  weight: "",
  calorieGoal: "",
  dietaryPreferences: "none",
  measurementUnit: "metric",
  mealsPerDay: "3",
  proteinPerMeal: "",
  fatPerMeal: "",
  carbsPerMeal: "",
  snacksPerDay: "2",
  proteinPerSnack: "",
  fatPerSnack: "",
  carbsPerSnack: "",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settingsRef = doc(db, "settings", "user");
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data() as UserSettings);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "user"), settings);
      toast({
        title: "Success",
        description: "Settings saved successfully",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = (key: keyof UserSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
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
            <h1 className="text-xl font-semibold">Settings</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="height">Height</Label>
                  <div className="flex gap-2">
                    <Input
                      id="height"
                      value={settings.height}
                      onChange={(e) => updateSetting("height", e.target.value)}
                      placeholder={
                        settings.measurementUnit === "metric" ? "cm" : "inches"
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight</Label>
                  <div className="flex gap-2">
                    <Input
                      id="weight"
                      value={settings.weight}
                      onChange={(e) => updateSetting("weight", e.target.value)}
                      placeholder={
                        settings.measurementUnit === "metric" ? "kg" : "lbs"
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Goals & Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="calorieGoal">Daily Calorie Goal</Label>
                <Input
                  id="calorieGoal"
                  value={settings.calorieGoal}
                  onChange={(e) => updateSetting("calorieGoal", e.target.value)}
                  placeholder="e.g., 2000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dietaryPreferences">Dietary Preferences</Label>
                <Select
                  value={settings.dietaryPreferences}
                  onValueChange={(value) =>
                    updateSetting("dietaryPreferences", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select dietary preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="vegetarian">Vegetarian</SelectItem>
                    <SelectItem value="vegan">Vegan</SelectItem>
                    <SelectItem value="pescatarian">Pescatarian</SelectItem>
                    <SelectItem value="keto">Keto</SelectItem>
                    <SelectItem value="paleo">Paleo</SelectItem>
                    <SelectItem value="kosher">Kosher</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="measurementUnit">Measurement Unit</Label>
                <Select
                  value={settings.measurementUnit}
                  onValueChange={(value) =>
                    updateSetting("measurementUnit", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select measurement unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metric">Metric (cm/kg)</SelectItem>
                    <SelectItem value="imperial">Imperial (in/lbs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Meal Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Main Meals</h3>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mealsPerDay">Number of meals per day</Label>
                    <Input
                      id="mealsPerDay"
                      type="number"
                      min="1"
                      max="6"
                      value={settings.mealsPerDay}
                      onChange={(e) =>
                        updateSetting("mealsPerDay", e.target.value)
                      }
                      placeholder="e.g., 3"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="proteinPerMeal">
                        Protein per meal (g)
                      </Label>
                      <Input
                        id="proteinPerMeal"
                        type="number"
                        min="0"
                        value={settings.proteinPerMeal}
                        onChange={(e) =>
                          updateSetting("proteinPerMeal", e.target.value)
                        }
                        placeholder="e.g., 30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fatPerMeal">Fat per meal (g)</Label>
                      <Input
                        id="fatPerMeal"
                        type="number"
                        min="0"
                        value={settings.fatPerMeal}
                        onChange={(e) =>
                          updateSetting("fatPerMeal", e.target.value)
                        }
                        placeholder="e.g., 20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="carbsPerMeal">Carbs per meal (g)</Label>
                      <Input
                        id="carbsPerMeal"
                        type="number"
                        min="0"
                        value={settings.carbsPerMeal}
                        onChange={(e) =>
                          updateSetting("carbsPerMeal", e.target.value)
                        }
                        placeholder="e.g., 50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-4">Snacks</h3>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="snacksPerDay">
                      Number of snacks per day
                    </Label>
                    <Input
                      id="snacksPerDay"
                      type="number"
                      min="0"
                      max="5"
                      value={settings.snacksPerDay}
                      onChange={(e) =>
                        updateSetting("snacksPerDay", e.target.value)
                      }
                      placeholder="e.g., 2"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="proteinPerSnack">
                        Protein per snack (g)
                      </Label>
                      <Input
                        id="proteinPerSnack"
                        type="number"
                        min="0"
                        value={settings.proteinPerSnack}
                        onChange={(e) =>
                          updateSetting("proteinPerSnack", e.target.value)
                        }
                        placeholder="e.g., 15"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fatPerSnack">Fat per snack (g)</Label>
                      <Input
                        id="fatPerSnack"
                        type="number"
                        min="0"
                        value={settings.fatPerSnack}
                        onChange={(e) =>
                          updateSetting("fatPerSnack", e.target.value)
                        }
                        placeholder="e.g., 10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="carbsPerSnack">Carbs per snack (g)</Label>
                      <Input
                        id="carbsPerSnack"
                        type="number"
                        min="0"
                        value={settings.carbsPerSnack}
                        onChange={(e) =>
                          updateSetting("carbsPerSnack", e.target.value)
                        }
                        placeholder="e.g., 25"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
