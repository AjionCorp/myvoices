"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { getConnection } from "@/lib/spacetimedb/client";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfileDialog({ open, onOpenChange }: EditProfileDialogProps) {
  const user = useAuthStore((s) => s.user);

  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [socialX, setSocialX] = useState("");
  const [socialYoutube, setSocialYoutube] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");
  const [socialInstagram, setSocialInstagram] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate fields when dialog opens
  useEffect(() => {
    if (!open || !user) return;
    const populateTimer = setTimeout(() => {
      setBio(user.bio ?? "");
      setLocation(user.location ?? "");
      setWebsiteUrl(user.websiteUrl ?? "");
      setSocialX(user.socialX ?? "");
      setSocialYoutube(user.socialYoutube ?? "");
      setSocialTiktok(user.socialTiktok ?? "");
      setSocialInstagram(user.socialInstagram ?? "");
      setError(null);
    }, 0);
    return () => clearTimeout(populateTimer);
  }, [open, user]);

  const handleSave = async () => {
    const conn = getConnection();
    if (!conn) {
      setError("Not connected. Please refresh and try again.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      conn.reducers.updateProfileDetails({
        bio,
        location,
        websiteUrl,
        socialX,
        socialYoutube,
        socialTiktok,
        socialInstagram,
      });
      // Close after a brief delay to let the subscription update
      setTimeout(() => {
        setSaving(false);
        onOpenChange(false);
      }, 300);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-white/10 bg-[#0e0e0e] text-white">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription className="text-white/45">
            Update your profile details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Bio */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              placeholder="Tell people about yourself..."
              className="h-20 resize-none border-white/10 bg-white/5 text-sm text-white placeholder:text-white/25"
            />
            <p className="text-right text-[10px] text-white/30">{bio.length}/160</p>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value.slice(0, 100))}
              placeholder="City, Country"
              className="border-white/10 bg-white/5 text-sm text-white placeholder:text-white/25"
            />
          </div>

          {/* Website */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Website</Label>
            <Input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value.slice(0, 200))}
              placeholder="https://example.com"
              className="border-white/10 bg-white/5 text-sm text-white placeholder:text-white/25"
            />
          </div>

          {/* Social links */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Social Links</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-white/30">𝕏</span>
                <Input
                  value={socialX}
                  onChange={(e) => setSocialX(e.target.value)}
                  placeholder="username"
                  className="border-white/10 bg-white/5 pl-7 text-sm text-white placeholder:text-white/25"
                />
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-white/30">YT</span>
                <Input
                  value={socialYoutube}
                  onChange={(e) => setSocialYoutube(e.target.value)}
                  placeholder="channel"
                  className="border-white/10 bg-white/5 pl-7 text-sm text-white placeholder:text-white/25"
                />
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-white/30">TT</span>
                <Input
                  value={socialTiktok}
                  onChange={(e) => setSocialTiktok(e.target.value)}
                  placeholder="username"
                  className="border-white/10 bg-white/5 pl-7 text-sm text-white placeholder:text-white/25"
                />
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-white/30">IG</span>
                <Input
                  value={socialInstagram}
                  onChange={(e) => setSocialInstagram(e.target.value)}
                  placeholder="username"
                  className="border-white/10 bg-white/5 pl-7 text-sm text-white placeholder:text-white/25"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-white/50 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-accent text-white hover:bg-accent/90"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
