"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { getConnection } from "@/lib/spacetimedb/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Account
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountMsg, setAccountMsg] = useState<string | null>(null);

  // Profile details
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [socialX, setSocialX] = useState("");
  const [socialYoutube, setSocialYoutube] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");
  const [socialInstagram, setSocialInstagram] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Load current values from SpacetimeDB
  useEffect(() => {
    if (!user) return;
    const conn = getConnection();
    if (!conn) return;
    const profile = conn.db.user_profile.identity.find(user.identity);
    if (!profile) return;
    setUsername(profile.username || "");
    setDisplayName(profile.displayName || "");
    setBio(profile.bio ?? "");
    setLocation(profile.location ?? "");
    setWebsiteUrl(profile.websiteUrl ?? "");
    setSocialX(profile.socialX ?? "");
    setSocialYoutube(profile.socialYoutube ?? "");
    setSocialTiktok(profile.socialTiktok ?? "");
    setSocialInstagram(profile.socialInstagram ?? "");
  }, [user]);

  const handleSaveAccount = () => {
    const conn = getConnection();
    if (!conn || !user) return;
    setAccountSaving(true);
    setAccountMsg(null);
    try {
      conn.reducers.updateProfile({
        username: username.trim(),
        displayName: displayName.trim(),
        email: user.email || "",
      });
      setAccountMsg("Account updated");
    } catch (e) {
      setAccountMsg(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setAccountSaving(false);
    }
  };

  const handleSaveProfile = () => {
    const conn = getConnection();
    if (!conn) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      conn.reducers.updateProfileDetails({
        bio: bio.trim(),
        location: location.trim(),
        websiteUrl: websiteUrl.trim(),
        socialX: socialX.trim(),
        socialYoutube: socialYoutube.trim(),
        socialTiktok: socialTiktok.trim(),
        socialInstagram: socialInstagram.trim(),
      });
      setProfileMsg("Profile updated");
    } catch (e) {
      setProfileMsg(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setProfileSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <h1 className="text-xl font-semibold text-foreground">Sign in to access settings</h1>
        <Button asChild>
          <Link href="/">Back to Canvas</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Back to Canvas</Link>
          </Button>
        </div>

        {/* Account Section */}
        <Card className="mb-6 gap-0 rounded-xl border-border bg-surface py-0">
          <CardHeader>
            <CardTitle className="text-lg">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-background"
                placeholder="your-username"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-background"
                placeholder="Your Name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Email</label>
              <p className="text-sm text-foreground">{user.email || "Not set"}</p>
              <p className="mt-1 text-xs text-muted">Email is managed by your sign-in provider.</p>
            </div>
            {accountMsg && (
              <p className={`text-xs ${accountMsg.includes("Failed") ? "text-red-400" : "text-green-400"}`}>
                {accountMsg}
              </p>
            )}
            <Button onClick={handleSaveAccount} disabled={accountSaving} size="sm">
              {accountSaving ? "Saving..." : "Save Account"}
            </Button>
          </CardContent>
        </Card>

        {/* Profile Details Section */}
        <Card className="mb-6 gap-0 rounded-xl border-border bg-surface py-0">
          <CardHeader>
            <CardTitle className="text-lg">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Bio</label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="resize-none bg-background"
                rows={3}
                maxLength={300}
                placeholder="Tell people about yourself..."
              />
              <p className="mt-1 text-right text-[11px] text-muted">{bio.length}/300</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Location</label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="bg-background"
                placeholder="City, Country"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Website</label>
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="bg-background"
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">X (Twitter)</label>
                <Input
                  value={socialX}
                  onChange={(e) => setSocialX(e.target.value)}
                  className="bg-background"
                  placeholder="@handle"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">YouTube</label>
                <Input
                  value={socialYoutube}
                  onChange={(e) => setSocialYoutube(e.target.value)}
                  className="bg-background"
                  placeholder="@channel"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">TikTok</label>
                <Input
                  value={socialTiktok}
                  onChange={(e) => setSocialTiktok(e.target.value)}
                  className="bg-background"
                  placeholder="@handle"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">Instagram</label>
                <Input
                  value={socialInstagram}
                  onChange={(e) => setSocialInstagram(e.target.value)}
                  className="bg-background"
                  placeholder="@handle"
                />
              </div>
            </div>
            {profileMsg && (
              <p className={`text-xs ${profileMsg.includes("Failed") ? "text-red-400" : "text-green-400"}`}>
                {profileMsg}
              </p>
            )}
            <Button onClick={handleSaveProfile} disabled={profileSaving} size="sm">
              {profileSaving ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        {/* Connected Accounts */}
        <Card className="mb-6 gap-0 rounded-xl border-border bg-surface py-0">
          <CardHeader>
            <CardTitle className="text-lg">Connected Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Stripe Connect</p>
                <p className="text-xs text-muted">Receive contest prize payouts</p>
              </div>
              {user.stripeAccountId ? (
                <Badge className="bg-green-500/20 text-green-400">Connected</Badge>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <Link href="/earnings">Set Up</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Credits */}
        <Card className="gap-0 rounded-xl border-border bg-surface py-0">
          <CardHeader>
            <CardTitle className="text-lg">Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Balance: <span className="tabular-nums text-accent">{(user.credits || 0).toLocaleString()}</span> credits
                </p>
                <p className="text-xs text-muted">Credits can be used for premium features</p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/earnings">View Earnings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
