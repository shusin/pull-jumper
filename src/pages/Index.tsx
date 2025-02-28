
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { format, parse, differenceInSeconds } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Trash, Plus, Info, Play } from "lucide-react";
import WarcraftLogsToYoutubeConverter from "@/components/WarcraftLogsToYoutubeConverter";
import { TimestampEntry } from "@/types/timestamp";

const Index = () => {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      <header className="w-full py-6 px-4 sm:px-6 md:px-8 border-b border-zinc-200 bg-white">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-medium tracking-tight">WoW Raid Timestamp Converter</h1>
          <p className="text-zinc-500 mt-1">Convert Warcraftlogs pull times to YouTube timestamps</p>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-8">
        <WarcraftLogsToYoutubeConverter />
      </main>

      <footer className="w-full py-6 px-4 sm:px-6 md:px-8 border-t border-zinc-200 bg-white">
        <div className="max-w-5xl mx-auto text-center text-zinc-500 text-sm">
          <p>Built to help World of Warcraft raiders create better YouTube content</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
