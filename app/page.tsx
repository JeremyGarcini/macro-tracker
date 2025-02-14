"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";

type AccessLevel = "basic" | "full";

export default function Home() {
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const router = useRouter();

  const checkAccess = (password: string): AccessLevel | null => {
    if (password === process.env.NEXT_PUBLIC_PASSWORD_USER) return "basic";
    if (password === process.env.NEXT_PUBLIC_PASSWORD_ADMIN) return "full";
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const access = checkAccess(password);

    if (access) {
      // Store access level in localStorage instead of sessionStorage
      localStorage.setItem("accessLevel", access);

      toast({
        title: "Success",
        description: "Welcome back, Jeremy",
        duration: 3000,
      });
      router.push("/dashboard");
    } else {
      toast({
        title: "Error",
        description: "Incorrect password. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-primary/10 p-3 rounded-full">
              <LockKeyhole className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-medium">Jeremy2025</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border-primary/20"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-primary/90 hover:bg-primary"
          >
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
