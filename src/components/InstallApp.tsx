import { useEffect, useState } from "react";
import { Download, Share, Plus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type PromptEvent = Event & { prompt: () => Promise<void> };

export const InstallApp = () => {
  const [deferred, setDeferred] = useState<PromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as PromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (deferred) {
    return (
      <Button
        variant="outline"
        onClick={async () => {
          await deferred.prompt();
          setDeferred(null);
        }}
      >
        <Download className="h-4 w-4 mr-2" />
        Install app
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Install app
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add PrintChat to your home screen</DialogTitle>
          <DialogDescription>
            It opens full screen like a normal app — no App Store needed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-semibold mb-2">{isIOS ? "iPhone / iPad (Safari)" : "iPhone / iPad (Safari)"}</p>
            <ol className="space-y-1 text-muted-foreground list-decimal list-inside">
              <li className="flex items-center gap-2">
                <Share className="h-4 w-4 shrink-0" /> Tap the Share button
              </li>
              <li className="flex items-center gap-2">
                <Plus className="h-4 w-4 shrink-0" /> Choose "Add to Home Screen"
              </li>
              <li>Tap "Add"</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold mb-2">Android (Chrome)</p>
            <ol className="space-y-1 text-muted-foreground list-decimal list-inside">
              <li className="flex items-center gap-2">
                <MoreVertical className="h-4 w-4 shrink-0" /> Open the browser menu
              </li>
              <li>Tap "Install app" or "Add to Home screen"</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold mb-2">Desktop (Chrome / Edge)</p>
            <p className="text-muted-foreground">
              Click the install icon in the address bar, or menu → "Install PrintChat".
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
