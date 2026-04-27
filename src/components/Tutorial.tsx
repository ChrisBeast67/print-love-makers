import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Sparkles, Users, Coins, ShoppingBag, MessageCircle, Gamepad2 } from "lucide-react";

const STORAGE_KEY = "printchat-tutorial-seen";

const steps = [
  {
    icon: Sparkles,
    title: "Welcome to PrintChat",
    body: "A hi-tech messenger where you can chat, make friends, earn credits, and customize your profile.",
  },
  {
    icon: MessageCircle,
    title: "Create chats from the home page",
    body: "Use the 'Create a group chat' card to start a new group. Click 'Create + copy invite' to instantly copy a shareable link anyone can join.",
  },
  {
    icon: Users,
    title: "Find friends",
    body: "Search by username in the 'Find people' card and send a friend request. Once accepted you can DM them or invite them to a new group with one click.",
  },
  {
    icon: Coins,
    title: "Earn credits daily",
    body: "Hit 'Claim daily +50' once a day for free credits. Soon you'll also earn by winning Parkour and Skribble mini-games inside group chats.",
  },
  {
    icon: ShoppingBag,
    title: "Spend in the Shop",
    body: "Open the Shop to buy profile packs — Robot, Animal, Circus, Underwater — in Common, Rare, Epic, and Legendary rarities. Equip one to show off.",
  },
  {
    icon: Gamepad2,
    title: "Mini-games (coming soon)",
    body: "Group chats will get a games button to launch a 2D parkour race or a Skribble drawing battle. Winners take credits.",
  },
];

export const Tutorial = ({ forceOpen = false, onClose }: { forceOpen?: boolean; onClose?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setStep(0);
      return;
    }
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, [forceOpen]);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
    onClose?.();
  };

  const S = steps[step];
  const Icon = S.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col items-center text-center py-2">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center mb-4 glow-box">
            <Icon className="h-7 w-7 text-primary-foreground" />
          </div>
          <DialogTitle className="text-xl">{S.title}</DialogTitle>
          <DialogDescription className="mt-2 text-sm">{S.body}</DialogDescription>
          <div className="flex gap-1 mt-5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-6 rounded-full ${i === step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          <div className="flex justify-between w-full mt-5 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {step < steps.length - 1 ? (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={close}>Get started</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
