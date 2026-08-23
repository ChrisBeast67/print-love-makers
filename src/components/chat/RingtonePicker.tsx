import { useState } from "react";
import { Bell, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { RINGTONES, RingtoneId, getRingtone, playMessageSound, setRingtone } from "@/lib/messageSound";

export const RingtonePicker = () => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<RingtoneId>(getRingtone());

  const choose = (id: RingtoneId) => {
    setSelected(id);
    setRingtone(id);
    playMessageSound(id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 px-2" aria-label="Message ringtone">
          <Bell className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message ringtone</DialogTitle>
          <DialogDescription>Plays when you receive a new message.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {RINGTONES.map((r) => (
            <div
              key={r.id}
              className={cn(
                "flex items-center justify-between rounded-lg border p-2 cursor-pointer transition-colors",
                selected === r.id ? "border-primary bg-primary/10" : "border-border/60 hover:bg-muted/40"
              )}
              onClick={() => choose(r.id)}
            >
              <span className="text-sm">{r.label}</span>
              {r.id !== "off" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  aria-label={`Preview ${r.label}`}
                  onClick={(e) => { e.stopPropagation(); playMessageSound(r.id); }}
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
