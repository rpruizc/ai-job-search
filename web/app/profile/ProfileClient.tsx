"use client";

import { useState, useEffect, useCallback } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

type ProfileSection = "identity" | "education" | "experience" | "skills" | "behavioral" | "preferences";

const SECTION_LABELS: Record<ProfileSection, string> = {
  identity: "Identity",
  education: "Education",
  experience: "Experience",
  skills: "Skills",
  behavioral: "Behavioral Profile",
  preferences: "Preferences",
};

const SECTION_DESCRIPTIONS: Record<ProfileSection, string> = {
  identity: "Name, location, languages, status, and contact info",
  education: "Degrees, institutions, and academic achievements",
  experience: "Work history, roles, and key accomplishments",
  skills: "Technical skills, tools, certifications, and domains",
  behavioral: "Working style, strengths, growth areas, and ideal environment",
  preferences: "Target sectors, deal-breakers, and what excites you",
};

const SECTIONS: ProfileSection[] = ["identity", "education", "experience", "skills", "behavioral", "preferences"];

export function ProfileClient() {
  const [profile, setProfile] = useState<Record<ProfileSection, string> | null>(null);
  const [editingSection, setEditingSection] = useState<ProfileSection | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    const res = await fetch("/api/profile");
    if (res.ok) {
      setProfile(await res.json());
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleEdit = (section: ProfileSection) => {
    if (!profile) return;
    setEditingSection(section);
    const content = profile[section];
    try {
      const parsed = JSON.parse(content);
      setEditContent(JSON.stringify(parsed, null, 2));
    } catch {
      setEditContent(content);
    }
    setError(null);
  };

  const handleSave = async () => {
    if (!editingSection) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/profile/${editingSection}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setEditingSection(null);
      fetchProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingSection(null);
    setEditContent("");
    setError(null);
  };

  const isEmpty = (content: string) => {
    if (!content || content === "{}") return true;
    try {
      const parsed = JSON.parse(content);
      return Object.keys(parsed).length === 0;
    } catch {
      return content.trim().length <= 2;
    }
  };

  const formatDisplay = (content: string) => {
    if (isEmpty(content)) return null;
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  };

  if (!profile) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="text-gray-500">Loading profile...</div>
      </div>
    );
  }

  const profileIsEmpty = SECTIONS.every((s) => isEmpty(profile[s]));

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/chat" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold">My Profile</h1>
        </div>
        <UserButton />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          {profileIsEmpty && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                Your profile is empty. Head to{" "}
                <Link href="/chat" className="font-medium underline">
                  Chat
                </Link>{" "}
                and start a conversation — the assistant will help you set up your profile. Or fill in the sections below manually.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {SECTIONS.map((section) => (
              <div key={section} className="rounded-lg border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <div>
                    <h2 className="font-medium text-gray-900">{SECTION_LABELS[section]}</h2>
                    <p className="text-sm text-gray-500">{SECTION_DESCRIPTIONS[section]}</p>
                  </div>
                  <button
                    onClick={() => handleEdit(section)}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
                  >
                    {isEmpty(profile[section]) ? "Add" : "Edit"}
                  </button>
                </div>

                {editingSection === section ? (
                  <div className="p-4">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows={10}
                      placeholder='Enter JSON or plain text, e.g. {"name": "John", "location": "Copenhagen"}'
                    />
                    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleCancel}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3">
                    {isEmpty(profile[section]) ? (
                      <p className="text-sm italic text-gray-400">Not set</p>
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm text-gray-700">
                        {formatDisplay(profile[section])}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
