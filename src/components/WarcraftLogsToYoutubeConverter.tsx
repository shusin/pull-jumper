
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { format, parse, differenceInSeconds } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Trash, Info, Clipboard, Link } from "lucide-react";
import { TimestampEntry, ParsedLogData, LogsApiResponse } from "@/types/timestamp";
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
  const [entries, setEntries] = useState<TimestampEntry[]>([]);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [pastedLogs, setPastedLogs] = useState("");
  const [youtubeFormatted, setYoutubeFormatted] = useState("");
  const [logsUrl, setLogsUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const clearAll = () => {
    setEntries([]);
    setVideoStartTime("");
    setPastedLogs("");
    setYoutubeFormatted("");
    setLogsUrl("");
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
    
    // Clear the text area
    setPastedLogs("");
    
    toast({
      title: "Pulls imported",
      description: `Successfully imported ${result.entries.length} pulls from logs.`,
    });
  };

  const fetchLogsFromUrl = async () => {
    if (!logsUrl) {
      toast({
        description: "Please enter a Warcraftlogs URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Extract the report ID from the URL
      // Example URL: https://www.warcraftlogs.com/reports/ABCdef123ghiJKL
      const urlMatch = logsUrl.match(/reports\/([a-zA-Z0-9]+)/);
      if (!urlMatch || !urlMatch[1]) {
        throw new Error("Invalid Warcraftlogs URL format");
      }
      
      const reportId = urlMatch[1];
      const apiKey = "47758fdaa87448d975d25d5741e7cae9"; // WarcraftLogs v1 API key
      
      // Fetch data from the API
      const response = await fetch(
        `https://www.warcraftlogs.com/v1/report/fights/${reportId}?api_key=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json() as LogsApiResponse;
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (!data.fights || data.fights.length === 0) {
        throw new Error("No fights found in the log");
      }
      
      // Convert the API data to our timestamp entries format
      const apiEntries: TimestampEntry[] = data.fights
        .filter(fight => fight.boss !== 0) // Filter out trash fights
        .map((fight, index) => {
          // Calculate the real date by adding the start_time (milliseconds) to the report start time
          const pullTimestamp = new Date(data.start + fight.startTime);
          const pullTime = pullTimestamp.toTimeString().split(' ')[0]; // Format as HH:MM:SS
          
          // Calculate duration
          const durationSeconds = Math.floor((fight.endTime - fight.startTime) / 1000);
          const minutes = Math.floor(durationSeconds / 60);
          const seconds = durationSeconds % 60;
          const durationFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          
          // Format the boss percentage if available
          const bossPercentage = fight.bossPercentage 
            ? `${Math.floor(100 - fight.bossPercentage / 100)}%` 
            : "";
          
          // Format the phase if available
          const phase = fight.lastPhaseForPercentageDisplay 
            ? (fight.lastPhaseIsIntermission 
                ? `I${fight.lastPhaseForPercentageDisplay}` 
                : `P${fight.lastPhaseForPercentageDisplay}`) 
            : "";
          
          // Create the entry name
          let entryName = `Pull ${index + 1}`;
          if (phase) {
            entryName += `: ${phase}`;
          }
          if (bossPercentage) {
            entryName += ` - ${bossPercentage}`;
          }
          entryName += ` (${durationFormatted})`;
          
          return {
            id: `api-${fight.id}-${index}`,
            name: entryName,
            pullTime: pullTime
          };
        });
      
      setEntries([...entries, ...apiEntries]);
      setLogsUrl("");
      
      toast({
        title: "Logs imported",
        description: `Successfully imported ${apiEntries.length} pulls from WarcraftLogs.`,
      });
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not fetch logs from URL",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-zinc-700 bg-zinc-900">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium">Timestamp Converter</h2>
            <div>
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

          <div className="space-y-6">
            <div>
              <Label htmlFor="videoStart">Video Start Time</Label>
              <div className="mt-1.5">
                <Input
                  id="videoStart"
                  placeholder="7:30 or 19:30 or 19:30:00"
                  value={videoStartTime}
                  onChange={(e) => setVideoStartTime(e.target.value)}
                />
              </div>
              <p className="text-sm text-zinc-400 mt-1.5">
                This is when your recording started in real time. For evening raid times, we'll assume PM if not specified.
              </p>
            </div>

            <Separator className="bg-zinc-700" />

            <div>
              <div className="flex items-center justify-between">
                <Label>Warcraftlogs Data</Label>
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Clear All
                </Button>
              </div>

              <div className="space-y-4 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="pasteArea">Paste text from Warcraftlogs</Label>
                  <Textarea
                    id="pasteArea"
                    placeholder="Paste text copied from Warcraftlogs here..."
                    value={pastedLogs}
                    onChange={(e) => setPastedLogs(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <Button 
                    onClick={importPulls} 
                    className="w-full"
                    disabled={!pastedLogs.trim()}
                  >
                    <Clipboard className="h-4 w-4 mr-2" />
                    Import from Pasted Text
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logsUrl">Or enter a Warcraftlogs URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="logsUrl"
                      placeholder="https://www.warcraftlogs.com/reports/..."
                      value={logsUrl}
                      onChange={(e) => setLogsUrl(e.target.value)}
                    />
                    <Button 
                      onClick={fetchLogsFromUrl} 
                      disabled={!logsUrl.trim() || isLoading}
                    >
                      <Link className="h-4 w-4 mr-2" />
                      {isLoading ? "Loading..." : "Fetch"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <ScrollArea className="h-[200px] rounded-md border border-zinc-700 p-2">
                  {entries.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                      <p>No pull times added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between p-3 bg-zinc-800 rounded-md"
                        >
                          <div className="flex-1 mr-4">
                            <p className="font-medium">{entry.name}</p>
                            <p className="text-zinc-400 text-sm">
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
              <Button 
                onClick={calculateTimestamps} 
                className="w-full"
                disabled={!videoStartTime || entries.length === 0}
              >
                Generate YouTube Timestamps
              </Button>
            </div>

            {youtubeFormatted && (
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="output">YouTube Timestamps</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <div className="relative">
                  <ScrollArea className="h-[200px] w-full rounded-md border border-zinc-700 p-4 bg-zinc-800">
                    <pre className="whitespace-pre-wrap break-all text-sm text-zinc-200">
                      {youtubeFormatted}
                    </pre>
                  </ScrollArea>
                </div>
                <p className="text-sm text-zinc-400">
                  Copy these timestamps to your YouTube video description
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <DialogContent className="bg-zinc-900 text-zinc-100 border-zinc-700">
          <DialogHeader>
            <DialogTitle>How to Use This Tool</DialogTitle>
            <DialogDescription className="text-zinc-400">
              <div className="space-y-4 mt-4">
                <div>
                  <h3 className="font-medium text-zinc-200">Step 1: Set Video Start Time</h3>
                  <p className="text-sm">
                    Enter the real-world time when you started your recording (e.g., 7:30 or 19:30).
                    For evening raid times, we'll assume PM if not specified.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-zinc-200">Step 2: Import Pull Times</h3>
                  <p className="text-sm">
                    Either paste text copied from Warcraftlogs or enter a Warcraftlogs URL to import pull data.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-zinc-200">Step 3: Generate Timestamps</h3>
                  <p className="text-sm">
                    Click "Generate YouTube Timestamps" to calculate the timestamps for your video.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-zinc-200">Step 4: Copy to YouTube</h3>
                  <p className="text-sm">
                    Copy the generated timestamps to your YouTube video description.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WarcraftLogsToYoutubeConverter;
