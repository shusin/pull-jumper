
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

  // Convert user input time (possibly in 12-hour format) to 24-hour format
  const normalizeTimeInput = (timeInput: string): string => {
    // Basic validation
    if (!timeInput) return "";

    // Check if input already has seconds
    const hasSeconds = timeInput.split(':').length > 2;
    
    try {
      // Try to parse as HH:mm:ss first
      if (hasSeconds) {
        parse(timeInput, "HH:mm:ss", new Date());
        return timeInput; // Already in correct format
      }
      
      // Try to parse as HH:mm
      try {
        const date = parse(timeInput, "HH:mm", new Date());
        return format(date, "HH:mm:ss");
      } catch (e) {
        // If that fails, assume it's h:mm format and PM (for evening raid times)
        const timeParts = timeInput.split(':');
        let hours = parseInt(timeParts[0]);
        const minutes = timeParts[1] ? parseInt(timeParts[1]) : 0;
        
        // If hours is less than 12, assume PM (for typical raid times)
        if (hours < 12) {
          hours += 12;
        }
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      }
    } catch (error) {
      // If all parsing fails, return original input
      return timeInput;
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
      // Normalize the video start time input
      const normalizedStartTime = normalizeTimeInput(videoStartTime);
      const videoStart = parse(normalizedStartTime, "HH:mm:ss", new Date());
      
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
      // Normalize and validate time format
      const normalizedTime = normalizeTimeInput(pullTime);
      parse(normalizedTime, "HH:mm:ss", new Date());

      const newEntry: TimestampEntry = {
        id: Date.now().toString(),
        name: pullName.trim(),
        pullTime: normalizedTime,
      };

      setEntries([...entries, newEntry]);
      setPullName("");
      setPullTime("");
    } catch (error) {
      toast({
        description: "Please enter time in a valid format (HH:mm, H:mm, or HH:mm:ss).",
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
      
      // For collecting multi-line data
      let currentPullNumber = "";
      let currentPullDuration = "";
      let currentPhase = "";
      let currentHealth = "";
      let currentTime = "";
      
      // Regular expressions to match patterns
      const pullNumberRegex = /^(\d+)\s+\((\d+):(\d+)\)/;  // Matches "1  (3:24)"
      const timeRegex = /(\d+):(\d+)\s+(AM|PM)/;  // Matches "7:46 PM"
      const phaseRegex = /(P\d+|I\d+)/;  // Matches "P2" or "I1" etc.
      const healthRegex = /^(\d+)%/;  // Matches "48%"
      
      // Loop through lines to collect information
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (!line) continue;
        
        // Look for health percentage
        const healthMatch = line.match(healthRegex);
        if (healthMatch) {
          currentHealth = healthMatch[1] + "%";
        }
        
        // Look for phase information
        const phaseMatch = line.match(phaseRegex);
        if (phaseMatch) {
          currentPhase = phaseMatch[1];
        }
        
        // Look for pull number and duration
        const pullMatch = line.match(pullNumberRegex);
        if (pullMatch) {
          currentPullNumber = pullMatch[1];
          currentPullDuration = `${pullMatch[2]}:${pullMatch[3]}`;
        }
        
        // Look for time
        const timeMatch = line.match(timeRegex);
        if (timeMatch) {
          let hour = parseInt(timeMatch[1]);
          const minute = timeMatch[2];
          const ampm = timeMatch[3];
          
          // Convert to 24-hour format
          if (ampm === "PM" && hour < 12) hour += 12;
          if (ampm === "AM" && hour === 12) hour = 0;
          
          currentTime = `${hour.toString().padStart(2, '0')}:${minute}:00`;
          
          // If we have all necessary information to create an entry
          if (currentPullNumber && currentTime) {
            // Format the pull name according to the new format: Pull X: Phase - Health% (duration)
            let formattedName = `Pull ${currentPullNumber}`;
            
            if (currentPhase) {
              formattedName += `: ${currentPhase}`;
            }
            
            if (currentHealth) {
              formattedName += ` - ${currentHealth}`;
            }
            
            if (currentPullDuration) {
              formattedName += ` (${currentPullDuration})`;
            }
            
            // Create and add the entry
            parsedEntries.push({
              id: Date.now() + i.toString(),
              name: formattedName,
              pullTime: currentTime
            });
            
            // Reset for next entry
            currentPullNumber = "";
            currentPullDuration = "";
            currentPhase = "";
            currentHealth = "";
            currentTime = "";
          }
        }
      }
      
      if (parsedEntries.length === 0) {
        return {
          valid: false,
          entries: [],
          errorMessage: "No valid pull data found in the text. Make sure it includes times in the format '7:46 PM'."
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
                  <Label htmlFor="videoStart">Video Start Time</Label>
                  <div className="flex mt-1.5 gap-2">
                    <Input
                      id="videoStart"
                      placeholder="7:30 or 19:30 or 19:30:00"
                      value={videoStartTime}
                      onChange={(e) => setVideoStartTime(e.target.value)}
                    />
                    <Button variant="outline" size="icon">
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-zinc-500 mt-1.5">
                    This is when your recording started in real time. For evening raid times, we'll assume PM if not specified.
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
                          placeholder="Time (7:30 or 19:30)"
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
                    Enter the real-world time when you started your recording (e.g., 7:30 or 19:30).
                    For evening raid times, we'll assume PM if not specified.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">Step 2: Add Pull Times</h3>
                  <p className="text-sm text-zinc-500">
                    Add each pull with a name and the time from Warcraftlogs,
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
