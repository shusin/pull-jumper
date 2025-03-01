
import { Card } from "@/components/ui/card";
import WarcraftLogsToYoutubeConverter from "@/components/WarcraftLogsToYoutubeConverter";

const Index = () => {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="w-full py-6 px-4 sm:px-6 md:px-8 border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-medium tracking-tight">WoW Raid Timestamp Converter</h1>
          <p className="text-zinc-400 mt-1">Convert Warcraftlogs pull times to YouTube timestamps</p>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-8">
        <WarcraftLogsToYoutubeConverter />
      </main>

      <footer className="w-full py-6 px-4 sm:px-6 md:px-8 border-t border-zinc-800 bg-zinc-900">
        <div className="max-w-5xl mx-auto text-center text-zinc-400 text-sm">
          <p>Built to help World of Warcraft raiders create better YouTube content</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
