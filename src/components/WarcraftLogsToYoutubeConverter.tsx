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
import { Copy, Trash, Plus, Info, Play, Clipboard } from "lucide-react";
import { TimestampEntry, ParsedLogData } from "@/types/timestamp";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const WarcraftLogsToYoutubeConverter = () => {
  const { toast } = useToast();
  const [videoStartTime, setVideoStartTime] = useState("");
  const [pullName, setPullName] = useState("");
  const [pullTime, setPullTime] = useState("");
  const [entries, setEntries] = useState<TimestampEntry[]>([]);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [pastedLogs, setPastedLogs] = useState("");
  const [youtubeFormatted, setYoutubeFormatted] = useState("");

  const clearAll = () => {
    setEntries([]);
    setVideoStartTime("");
    setPullName("");
    setPullTime("");
    setYoutubeFormatted("");
  };

  const formatTimeForYoutube = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
        .toString()
        .padStart(2, "0")}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
  };

  const calculateTimestamps = () => {
    if (!videoStartTime || entries.length === 0) {
      toast({
        title: "Missing information",
        description: "Please set a video start time and add at least one pull.",
        variant: "destructive",
      });
      return;
    }

    try {
      const videoStart = parse(videoStartTime, "HH:mm:ss", new Date());
      
      const formattedEntries = entries.map((entry) => {
        const pullDateTime = parse(entry.pullTime, "HH:mm:ss", new Date());
        
        // Calculate difference in seconds between pull time and video start time
        let diffInSeconds = differenceInSeconds(pullDateTime, videoStart);
        
        // Handle times that cross midnight
        if (diffInSeconds < 0) {
          diffInSeconds = diffInSeconds + 24 * 60 * 60;
        }
        
        // Format for YouTube
        const youtubeTimestamp = formatTimeForYoutube(diffInSeconds);
        return `${youtubeTimestamp} ${entry.name}`;
      }).join("\n");

      setYoutubeFormatted(formattedEntries);
      
      toast({
        title: "Timestamps calculated",
        description: "Your YouTube timestamps are ready to copy.",
      });
    } catch (error) {
      toast({
        title: "Error calculating timestamps",
        description: "Please check your time formats and try again.",
        variant: "destructive",
      });
    }
  };

  const addPull = () => {
    if (!pullName.trim() || !pullTime.trim()) {
      toast({
        description: "Please enter both a pull name and time.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate time format
      parse(pullTime, "HH:mm:ss", new Date());

      const newEntry: TimestampEntry = {
        id: Date.now().toString(),
        name: pullName.trim(),
        pullTime: pullTime.trim(),
      };

      setEntries([...entries, newEntry]);
      setPullName("");
      setPullTime("");
    } catch (error) {
      toast({
        description: "Please enter time in HH:mm:ss format.",
        variant: "destructive",
      });
    }
  };

  const removePull = (id: string) => {
    setEntries(entries.filter((entry) => entry.id !== id));
  };

  const copyToClipboard = () => {
    if (!youtubeFormatted) {
      toast({
        description: "Generate timestamps first.",
        variant: "destructive",
      });
      return;
    }

    navigator.clipboard.writeText(youtubeFormatted);
    toast({
      description: "Timestamps copied to clipboard.",
    });
  };

  const parseWarcraftlogs = (text: string): ParsedLogData => {
    if (!text.trim()) {
      return {
        valid: false,
        entries: [],
        errorMessage: "No text provided"
      };
    }

    try {
      // Split text into lines
      const lines = text.split('\n');
      const parsedEntries: TimestampEntry[] = [];
      
      // Regular expression to match time patterns like "20:15:30" or "8:45:12"
      const timeRegex = /(\d{1,2}):(\d{2}):(\d{2})/;
      
      // Process each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (!line) continue;
        
        // Look for time pattern
        const timeMatch = line.match(timeRegex);
        if (timeMatch) {
          let pullName = "";
          
          // Extract hours, minutes, seconds and ensure proper formatting
          const hours = timeMatch[1].padStart(2, '0');
          const minutes = timeMatch[2];
          const seconds = timeMatch[3];
          const timeString = `${hours}:${minutes}:${seconds}`;
          
          // Look for potential pull name in the line
          // First try to extract pull name before the time
          const beforeTime = line.split(timeMatch[0])[0].trim();
          // Then try after the time
          const afterTime = line.split(timeMatch[0])[1]?.trim() || "";
          
          // Choose the most likely pull name section
          if (beforeTime.length > 0 && beforeTime.length <= 50) {
            // If text before time is reasonable length, use it
            pullName = beforeTime;
          } else if (afterTime.length > 0 && afterTime.length <= 50) {
            // Otherwise use text after time if it exists and is reasonable
            pullName = afterTime;
          } else {
            // If no good name found, use a generic name
            pullName = `Pull ${parsedEntries.length + 1}`;
          }
          
          // Clean up the pull name - attempt to extract boss/encounter names
          // This is a simple heuristic that might need adjustment based on actual log formats
          pullName = pullName
            .replace(/pull\s*\d+/i, '') // Remove "Pull X" text
            .replace(/\(.*?\)/, '') // Remove parenthetical comments
            .replace(/started|beginning|starting|wipe|kill|attempt/gi, '') // Remove common status words
            .trim();
          
          // If cleaned up name is too short, revert to original or use generic
          if (pullName.length < 2) {
            pullName = beforeTime || afterTime || `Pull ${parsedEntries.length + 1}`;
          }
          
          // Add the entry
          parsedEntries.push({
            id: Date.now() + i.toString(),
            name: pullName,
            pullTime: timeString,
          });
        }
      }
      
      if (parsedEntries.length === 0) {
        return {
          valid: false,
          entries: [],
          errorMessage: "No valid timestamps found in the text"
        };
      }
      
      return {
        valid: true,
        entries: parsedEntries
      };
    } catch (error) {
      return {
        valid: false,
        entries: [],
        errorMessage: "Error parsing logs"
      };
    }
  };

  const importPulls = () => {
    const result = parseWarcraftlogs(pastedLogs);
    
    if (!result.valid) {
      toast({
        title: "Import failed",
        description: result.errorMessage || "Could not parse the logs",
        variant: "destructive",
      });
      return;
    }
    
    // Add the new entries
    setEntries([...entries, ...result.entries]);
    
    // Close the dialog and clear the text area
    setBulkImportOpen(false);
    setPastedLogs("");
    
    toast({
      title: "Pulls imported",
      description: `Successfully imported ${result.entries.length} pulls from logs.`,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-zinc-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium">Timestamp Converter</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setBulkImportOpen(true)}
                title="Import from Warcraftlogs"
              >
                <Clipboard className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setInfoDialogOpen(true)}
                title="How to use"
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Tabs defaultValue="input">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="input">Input</TabsTrigger>
              <TabsTrigger value="output">Output</TabsTrigger>
            </TabsList>

            <TabsContent value="input" className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="videoStart">Video Start Time (HH:mm:ss)</Label>
                  <div className="flex mt-1.5 gap-2">
                    <Input
                      id="videoStart"
                      placeholder="00:00:00"
                      value={videoStartTime}
                      onChange={(e) => setVideoStartTime(e.target.value)}
                    />
                    <Button variant="outline" size="icon">
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-zinc-500 mt-1.5">
                    This is when your recording started in real time
                  </p>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center justify-between">
                    <Label>Warcraftlogs Pull Times</Label>
                    <Button variant="ghost" size="sm" onClick={clearAll}>
                      Clear All
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 mt-3">
                    <div className="grid grid-cols-4 gap-2">
                      <div className="col-span-2">
                        <Input
                          placeholder="Pull name or boss"
                          value={pullName}
                          onChange={(e) => setPullName(e.target.value)}
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          placeholder="HH:mm:ss"
                          value={pullTime}
                          onChange={(e) => setPullTime(e.target.value)}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          onClick={addPull}
                          className="w-full"
                          variant="outline"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <ScrollArea className="h-[200px]">
                      {entries.length === 0 ? (
                        <div className="text-center py-8 text-zinc-400">
                          <p>No pull times added yet</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between p-3 bg-zinc-50 rounded-md"
                            >
                              <div className="flex-1 mr-4">
                                <p className="font-medium">{entry.name}</p>
                                <p className="text-zinc-500 text-sm">
                                  {entry.pullTime}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removePull(entry.id)}
                              >
                                <Trash className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>

                <div className="pt-4">
                  <Button onClick={calculateTimestamps} className="w-full">
                    Generate YouTube Timestamps
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="output" className="space-y-6">
              <div className="space-y-4">
                <Label htmlFor="output">YouTube Timestamps</Label>
                <div className="relative">
                  <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                    <pre
                      className={cn(
                        "whitespace-pre-wrap break-all text-sm",
                        !youtubeFormatted && "text-zinc-400"
                      )}
                    >
                      {youtubeFormatted || "No timestamps generated yet. Switch to the Input tab to add pull times."}
                    </pre>
                  </ScrollArea>
                  {youtubeFormatted && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={copyToClipboard}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {youtubeFormatted && (
                  <p className="text-sm text-zinc-500">
                    Copy these timestamps to your YouTube video description
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>

      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How to Use This Tool</DialogTitle>
            <DialogDescription>
              <div className="space-y-4 mt-4">
                <div>
                  <h3 className="font-medium">Step 1: Set Video Start Time</h3>
                  <p className="text-sm text-zinc-500">
                    Enter the real-world time when you started your recording in HH:mm:ss format.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">Step 2: Add Pull Times</h3>
                  <p className="text-sm text-zinc-500">
                    Add each pull with a name and the time from Warcraftlogs in HH:mm:ss format, 
                    or use the bulk import feature to paste text copied from Warcraftlogs.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">Step 3: Generate Timestamps</h3>
                  <p className="text-sm text-zinc-500">
                    Click "Generate YouTube Timestamps" to calculate the timestamps for your video.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">Step 4: Copy to YouTube</h3>
                  <p className="text-sm text-zinc-500">
                    Copy the generated timestamps to your YouTube video description.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Import from Warcraftlogs</DialogTitle>
            <DialogDescription>
              Paste the text copied from Warcraftlogs that contains pull times.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-2">
            <Textarea 
              placeholder="Paste Warcraftlogs text here..." 
              className="min-h-[200px]"
              value={pastedLogs}
              onChange={(e) => setPastedLogs(e.target.value)}
            />
            
            <div className="text-sm text-zinc-500 space-y-2">
              <h4 className="font-medium">How to copy text from Warcraftlogs:</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Open your raid log on Warcraftlogs</li>
                <li>Go to the "Fights" tab that lists all pulls</li>
                <li>Select all text (Ctrl+A) or the section with pull times</li>
                <li>Copy (Ctrl+C) and paste here</li>
              </ol>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkImportOpen(false)}>
                Cancel
              </Button>
              <Button onClick={importPulls}>
                Import Pulls
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WarcraftLogsToYoutubeConverter;
