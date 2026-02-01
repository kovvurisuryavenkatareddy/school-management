import { ShieldAlert, Construction } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-background rounded-2xl border shadow-2xl p-10 text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <ShieldAlert size={48} />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black font-ubuntu tracking-tight text-foreground">Access Disabled</h1>
          <p className="text-muted-foreground font-medium">
            The portal is currently undergoing scheduled maintenance or has been temporarily disabled by the administrator.
          </p>
        </div>
        <div className="pt-4 border-t flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-primary bg-primary/5 px-4 py-2 rounded-lg">
            <Construction className="h-4 w-4" />
            Maintenance in Progress
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            Please check back later
          </p>
        </div>
      </div>
    </div>
  );
}