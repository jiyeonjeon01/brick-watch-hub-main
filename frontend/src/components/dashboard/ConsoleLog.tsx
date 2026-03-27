import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal } from "lucide-react";

interface ConsoleLogProps {
  logs: string[];
}

export function ConsoleLog({ logs }: ConsoleLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Terminal className="h-4 w-4" />
          Console
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[180px]">
          <div className="rounded-b-lg bg-foreground/95 p-3 font-mono text-xs leading-relaxed text-primary-foreground">
            {logs.map((log, i) => (
              <div key={i} className="opacity-90 hover:opacity-100">
                {log}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
