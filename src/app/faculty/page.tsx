"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../../lib/config/api";

type Settings = {
  scenarioId: string;
  enableClientScenario: boolean;
  enableClientSystemPrompt: boolean;
};

const SCENARIOS = [
  { id: "lowBackPain", label: "Low Back Pain" },
  { id: "aclRehab", label: "ACL Rehab (6 weeks)" },
  { id: "rotatorCuff", label: "Rotator Cuff Pain" },
  { id: "strokeGait", label: "Post‑Stroke Gait" },
  { id: "ankleSprain", label: "Ankle Sprain" },
];

export default function FacultyPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/faculty/settings"), {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load settings");
      setSettings(data);
    } catch (e: any) {
      setError(e.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(getApiUrl("/api/faculty/settings"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      setSettings(data);
      setSaved(true);
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-4">Faculty Settings</h1>

      <section>
        <h2 className="text-lg font-semibold mb-2">PT Scenario</h2>
        {loading && <div>Loading…</div>}
        {error && <div className="text-red-300">{error}</div>}
        {settings && (
          <div className="grid gap-4">
            <div>
              <label
                className="block font-semibold mb-1"
                htmlFor="active-scenario"
              >
                Active scenario
              </label>
              <select
                id="active-scenario"
                aria-label="Active scenario"
                value={settings.scenarioId}
                onChange={(e) =>
                  setSettings({ ...settings, scenarioId: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-neutral-600 bg-transparent"
              >
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.enableClientScenario}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      enableClientScenario: e.target.checked,
                    })
                  }
                />
                Allow client to choose scenario (header/body)
              </label>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.enableClientSystemPrompt}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      enableClientSystemPrompt: e.target.checked,
                    })
                  }
                />
                Allow client system prompt override (not recommended)
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="px-3 py-2 rounded-lg border border-neutral-600"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={refresh}
                disabled={loading}
                className="px-3 py-2 rounded-lg border border-neutral-600"
              >
                Refresh
              </button>
              {saved && <span className="text-green-300">Saved ✓</span>}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
