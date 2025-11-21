import React from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, Settings2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";

interface HeaderProps {
  onExport: () => void;
  onImport: (files: FileList | null) => void;
  isExporting: boolean;
}

export function Header({ onExport, onImport, isExporting }: HeaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onImport(e.target.files);
  };

  return (
    <header className="flex items-center justify-between border-b border-border/50 bg-background px-4 py-3">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Video Studio</h1>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept="video/*,audio/*,image/*"
          onChange={handleFileChange}
        />
        <Button variant="outline" size="sm" onClick={handleImportClick}>
          <Upload className="mr-2 size-4" />
          Import Media
        </Button>
        <Sheet>
          <SheetTrigger asChild>
            <Button size="sm">
              <Download className="mr-2 size-4" />
              Export
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Export Video</SheetTitle>
              <SheetDescription>
                Choose your export settings.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="mp4" defaultChecked disabled />
                <label
                  htmlFor="mp4"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  High Quality Video (WebM)
                </label>
              </div>
              {/* Add more export options here if needed */}
            </div>
            <SheetFooter>
              <Button onClick={onExport} disabled={isExporting}>
                {isExporting ? "Exporting..." : "Start Export"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <Button variant="ghost" size="icon">
          <Settings2 className="size-4" />
        </Button>
      </div>
    </header>
  );
}

