"use client";

import { useMemo, useState } from "react";
import { getConnection } from "@/lib/spacetimedb/client";
import { useTopicStore } from "@/stores/topic-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type TaxonomyReducers = {
  createTopicTaxonomyNode?: (args: { name: string; parentId: bigint | null }) => void;
  backfillTopicTaxonomyFromCategories?: () => void;
};

function NodeRow({
  id,
  name,
  path,
  depth,
  topicCount,
}: {
  id: number;
  name: string;
  path: string;
  depth: number;
  topicCount: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-light px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {"\u00A0".repeat(depth * 2)}
          {name}
        </p>
        <p className="truncate text-xs text-muted">{path}</p>
      </div>
      <div className="ml-3 flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          id:{id}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {topicCount} topic{topicCount === 1 ? "" : "s"}
        </Badge>
      </div>
    </div>
  );
}

export default function AdminTaxonomyPage() {
  const taxonomyNodes = useTopicStore((s) => s.taxonomyNodes);
  const topics = useTopicStore((s) => s.topics);
  const [name, setName] = useState("");
  const [parentSearch, setParentSearch] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { nodes, topicCountByNode } = useMemo(() => {
    const allNodes = [...taxonomyNodes.values()].sort(
      (a, b) => a.depth - b.depth || a.path.localeCompare(b.path)
    );
    const countByNode = new Map<number, number>();
    for (const topic of topics.values()) {
      if (!topic.taxonomyNodeId) continue;
      countByNode.set(topic.taxonomyNodeId, (countByNode.get(topic.taxonomyNodeId) ?? 0) + 1);
    }
    return { nodes: allNodes, topicCountByNode: countByNode };
  }, [taxonomyNodes, topics]);

  const filteredParentCandidates = nodes.filter((n) => {
    const query = parentSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      n.name.toLowerCase().includes(query) ||
      n.path.toLowerCase().includes(query) ||
      String(n.id).includes(query)
    );
  });
  const selectedParentNode = selectedParentId ? nodes.find((n) => n.id === selectedParentId) ?? null : null;

  const getReducers = (): TaxonomyReducers => {
    return (getConnection()?.reducers as unknown as TaxonomyReducers) || {};
  };

  const handleCreateNode = () => {
    if (!name.trim()) {
      setError("Node name is required.");
      return;
    }

    const reducers = getReducers();
    if (!reducers.createTopicTaxonomyNode) {
      setError("Not connected to SpacetimeDB reducers yet.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      reducers.createTopicTaxonomyNode({
        name: name.trim(),
        parentId: selectedParentId === null ? null : BigInt(selectedParentId),
      });
      setName("");
      setParentSearch("");
      setSelectedParentId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create taxonomy node.");
    } finally {
      setBusy(false);
    }
  };

  const handleBackfill = () => {
    const reducers = getReducers();
    if (!reducers.backfillTopicTaxonomyFromCategories) {
      setError("Not connected to SpacetimeDB reducers yet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      reducers.backfillTopicTaxonomyFromCategories();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to run backfill.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Taxonomy Management</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="gap-0 rounded-xl border-border bg-surface py-0">
          <CardHeader>
            <CardTitle className="text-lg">Create Taxonomy Node</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Name</label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Science, Physics, Neuroscience"
                className="bg-background"
                disabled={busy}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Parent Node (optional)</label>
              <Input
                value={parentSearch}
                onChange={(e) => {
                  setParentSearch(e.target.value);
                  setError(null);
                }}
                placeholder="Search by name/path/id..."
                className="bg-background"
                disabled={busy}
              />
              <div className="mt-2 max-h-36 overflow-auto rounded-lg border border-border bg-background">
                <button
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-xs ${
                    selectedParentId === null ? "bg-accent/10 text-accent-light" : "text-muted hover:bg-surface-light"
                  }`}
                  onClick={() => setSelectedParentId(null)}
                  disabled={busy}
                >
                  Top-level (no parent)
                </button>
                {filteredParentCandidates.slice(0, 50).map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className={`block w-full px-3 py-2 text-left text-xs ${
                      selectedParentId === node.id ? "bg-accent/10 text-accent-light" : "text-muted hover:bg-surface-light"
                    }`}
                    onClick={() => setSelectedParentId(node.id)}
                    disabled={busy}
                  >
                    {node.path} (id:{node.id})
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">
                Selected: {selectedParentNode ? `${selectedParentNode.path} (id:${selectedParentNode.id})` : "Top-level"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleCreateNode} disabled={busy}>
                {busy ? "Saving..." : "Create Node"}
              </Button>
              <Button onClick={handleBackfill} variant="outline" disabled={busy}>
                Backfill Existing Topics
              </Button>
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 rounded-xl border-border bg-surface py-0">
          <CardHeader>
            <CardTitle className="text-lg">Current Taxonomy Tree</CardTitle>
          </CardHeader>
          <CardContent>
            {nodes.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">
                No taxonomy nodes yet. Create a top-level node like Science first.
              </p>
            ) : (
              <div className="space-y-2">
                {nodes.map((node) => (
                  <NodeRow
                    key={node.id}
                    id={node.id}
                    name={node.name}
                    path={node.path}
                    depth={node.depth}
                    topicCount={topicCountByNode.get(node.id) ?? 0}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
