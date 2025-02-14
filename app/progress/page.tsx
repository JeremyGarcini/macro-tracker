"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  ChevronLeft,
  Plus,
  ArrowUpDown,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  orderBy,
} from "firebase/firestore";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type WeightEntry = {
  id: string;
  date: number;
  weight: number;
};

type TimeRange = "week" | "month" | "year";

export default function ProgressPage() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weight, setWeight] = useState("");
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("month");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { toast } = useToast();

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const entriesRef = collection(db, "weight_entries");
      const q = query(entriesRef, orderBy("date", "desc"));
      const querySnapshot = await getDocs(q);
      const loadedEntries = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WeightEntry[];
      setEntries(loadedEntries);
    } catch (error) {
      console.error("Error loading entries:", error);
      toast({
        title: "Error",
        description: "Failed to load weight entries",
        variant: "destructive",
      });
    }
  };

  const handleAddEntry = async () => {
    if (!weight) return;

    try {
      const weightNum = parseFloat(weight);
      if (isNaN(weightNum)) throw new Error("Invalid weight");

      const entry = {
        date: selectedDate.getTime(),
        weight: weightNum,
      };

      await addDoc(collection(db, "weight_entries"), entry);
      await loadEntries();
      setIsAddModalOpen(false);
      setWeight("");
      setSelectedDate(new Date());
      toast({
        title: "Success",
        description: "Weight entry added successfully",
      });
    } catch (error) {
      console.error("Error adding entry:", error);
      toast({
        title: "Error",
        description: "Failed to add weight entry",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;

    try {
      await deleteDoc(doc(db, "weight_entries", entryToDelete));
      await loadEntries();
      toast({
        title: "Success",
        description: "Weight entry deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast({
        title: "Error",
        description: "Failed to delete weight entry",
        variant: "destructive",
      });
    } finally {
      setEntryToDelete(null);
    }
  };

  const getChartData = () => {
    const sortedEntries = [...entries].sort((a, b) => a.date - b.date);
    return sortedEntries.map((entry) => ({
      date: format(new Date(entry.date), "MMM d"),
      weight: entry.weight,
    }));
  };

  const calculateProgress = () => {
    if (entries.length < 2) return null;

    const sortedEntries = [...entries].sort((a, b) => a.date - b.date);
    const firstEntry = sortedEntries[0];
    const lastEntry = sortedEntries[sortedEntries.length - 1];
    const weightDiff = lastEntry.weight - firstEntry.weight;
    
    return {
      total: Math.abs(weightDiff).toFixed(1),
      direction: weightDiff <= 0 ? "lost" : "gained",
    };
  };

  const progress = calculateProgress();

  const getSortedEntries = () => {
    return [...entries].sort((a, b) => {
      const dateA = a.date;
      const dateB = b.date;
      return sortDirection === "desc" ? dateB - dateA : dateA - dateB;
    });
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
            <h1 className="text-xl font-semibold">Progress Tracking</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {progress ? (
                <p className="text-2xl font-bold">
                  {progress.total} kg {progress.direction}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Add weight entries to track progress
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Weight Progress</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={timeRange === "week" ? "default" : "outline"}
                  onClick={() => setTimeRange("week")}
                >
                  Week
                </Button>
                <Button
                  variant={timeRange === "month" ? "default" : "outline"}
                  onClick={() => setTimeRange("month")}
                >
                  Month
                </Button>
                <Button
                  variant={timeRange === "year" ? "default" : "outline"}
                  onClick={() => setTimeRange("year")}
                >
                  Year
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Weight Entries</CardTitle>
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setSortDirection(prev =>
                          prev === "desc" ? "asc" : "desc"
                        )
                      }
                      className="flex items-center gap-2"
                    >
                      Date
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Weight (kg)</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getSortedEntries().map((entry, index, arr) => {
                  const prevEntry = arr[index + 1];
                  const change = prevEntry
                    ? (entry.weight - prevEntry.weight).toFixed(1)
                    : "-";
                  const changeClass =
                    change !== "-"
                      ? parseFloat(change) < 0
                        ? "text-green-600"
                        : parseFloat(change) > 0
                        ? "text-red-600"
                        : ""
                      : "";

                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {format(new Date(entry.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{entry.weight}</TableCell>
                      <TableCell className={changeClass}>
                        {change !== "-" && change !== "0.0"
                          ? `${change > "0" ? "+" : ""}${change}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setEntryToDelete(entry.id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Weight Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border"
              />
            </div>
            <div className="space-y-2">
              <Input
                type="number"
                step="0.1"
                placeholder="Weight in kg"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddEntry}>Add Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!entryToDelete}
        onOpenChange={() => setEntryToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this weight entry? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}