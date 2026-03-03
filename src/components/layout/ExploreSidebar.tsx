"use client";

import { useMemo, useState, useCallback } from "react";
import { X, ChevronRight, ChevronDown, Globe, BookMarked, Star } from "lucide-react";
import { useExploreStore } from "@/stores/explore-store";
import { useTopicStore, type TopicTaxonomyNode } from "@/stores/topic-store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ClearableInput } from "@/components/ui/clearable-input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_GROUPS } from "@/lib/constants";

// ─── Tree node shape ───────────────────────────────────────────────────────────
interface TreeNode {
  node: TopicTaxonomyNode;
  children: TreeNode[];
  topicCount: number;
}

// ─── Build tree from flat taxonomy map ─────────────────────────────────────────
function buildTree(
  nodes: Map<number, TopicTaxonomyNode>,
  topicCountByNodeId: Map<number, number>,
): TreeNode[] {
  const nodeMap = new Map<number, TreeNode>();

  for (const n of nodes.values()) {
    nodeMap.set(n.id, { node: n, children: [], topicCount: topicCountByNodeId.get(n.id) ?? 0 });
  }

  const roots: TreeNode[] = [];

  for (const tn of nodeMap.values()) {
    if (tn.node.parentId === null) {
      roots.push(tn);
    } else {
      const parent = nodeMap.get(tn.node.parentId);
      if (parent) parent.children.push(tn);
    }
  }

  function bubbleCount(tn: TreeNode): number {
    const childTotal = tn.children.reduce((acc, c) => acc + bubbleCount(c), 0);
    tn.topicCount += childTotal;
    return tn.topicCount;
  }
  for (const root of roots) bubbleCount(root);

  function sortTree(nodes: TreeNode[]) {
    nodes.sort((a, b) => b.topicCount - a.topicCount);
    for (const n of nodes) sortTree(n.children);
  }
  sortTree(roots);

  return roots;
}

// ─── Collect all descendant paths ─────────────────────────────────────────────
function collectDescendantPaths(tn: TreeNode): string[] {
  const paths: string[] = [tn.node.path];
  for (const child of tn.children) {
    paths.push(...collectDescendantPaths(child));
  }
  return paths;
}

// ─── Single tree row ───────────────────────────────────────────────────────────
function TreeRow({
  tn,
  depth,
  expanded,
  onToggleExpand,
  checked,
  indeterminate,
  onToggleCheck,
}: {
  tn: TreeNode;
  depth: number;
  expanded: boolean;
  onToggleExpand: () => void;
  checked: boolean;
  indeterminate: boolean;
  onToggleCheck: () => void;
}) {
  const hasChildren = tn.children.length > 0;
  const indent = depth * 16;

  return (
    <div
      style={{ paddingLeft: indent + 8 }}
      className="group flex items-center gap-1.5 py-[5px] pr-3 rounded-md hover:bg-accent/50 cursor-pointer select-none"
    >
      {/* Expand / collapse chevron */}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggleExpand(); }}
        className="shrink-0 h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
        aria-label={expanded ? "Collapse" : "Expand"}
      >
        {hasChildren ? (
          expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
        ) : (
          <span className="w-3 block" />
        )}
      </Button>

      {/* Checkbox — shadcn Checkbox with indeterminate support */}
      <Checkbox
        checked={indeterminate ? "indeterminate" : checked}
        onCheckedChange={() => onToggleCheck()}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 h-[15px] w-[15px] rounded-[3px] border-border data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600 data-[state=indeterminate]:bg-violet-600/40 data-[state=indeterminate]:border-violet-600"
      />

      {/* Label */}
      <span
        onClick={onToggleExpand}
        className={`flex-1 min-w-0 text-[12.5px] leading-tight truncate transition-colors ${
          checked || indeterminate ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {tn.node.name}
      </span>

      {/* Count badge */}
      {tn.topicCount > 0 && (
        <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground/60">
          {tn.topicCount}
        </span>
      )}
    </div>
  );
}

// ─── Recursive tree subtree ────────────────────────────────────────────────────
function TreeSubtree({
  nodes,
  depth,
  expandedIds,
  onToggleExpand,
  selectedPaths,
  onToggleNode,
}: {
  nodes: TreeNode[];
  depth: number;
  expandedIds: Set<number>;
  onToggleExpand: (id: number) => void;
  selectedPaths: Set<string>;
  onToggleNode: (tn: TreeNode) => void;
}) {
  return (
    <>
      {nodes.map((tn) => {
        const allDescendantPaths = collectDescendantPaths(tn);
        const checkedCount = allDescendantPaths.filter((p) => selectedPaths.has(p)).length;
        const checked = checkedCount === allDescendantPaths.length && allDescendantPaths.length > 0;
        const indeterminate = checkedCount > 0 && !checked;
        const isExpanded = expandedIds.has(tn.node.id);

        return (
          <div key={tn.node.id}>
            <TreeRow
              tn={tn}
              depth={depth}
              expanded={isExpanded}
              onToggleExpand={() => onToggleExpand(tn.node.id)}
              checked={checked}
              indeterminate={indeterminate}
              onToggleCheck={() => onToggleNode(tn)}
            />
            {isExpanded && tn.children.length > 0 && (
              <TreeSubtree
                nodes={tn.children}
                depth={depth + 1}
                expandedIds={expandedIds}
                onToggleExpand={onToggleExpand}
                selectedPaths={selectedPaths}
                onToggleNode={onToggleNode}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Nav item ──────────────────────────────────────────────────────────────────
type NavTab = "explore" | "library" | "favorites";

function NavItem({
  icon,
  label,
  active,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      onClick={onClick}
      disabled={disabled}
      className="w-full justify-start gap-2.5 text-[13px] font-normal data-[active=true]:font-semibold"
      data-active={active}
    >
      {icon}
      <span>{label}</span>
      {disabled && (
        <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0 tracking-wide uppercase text-muted-foreground/50 border-muted-foreground/20">
          soon
        </Badge>
      )}
    </Button>
  );
}

// ─── Main sidebar ──────────────────────────────────────────────────────────────
export function ExploreSidebar() {
  const sidebarOpen    = useExploreStore((s) => s.sidebarOpen);
  const setSidebarOpen = useExploreStore((s) => s.setSidebarOpen);
  const selectedPaths  = useExploreStore((s) => s.selectedPaths);
  const setPaths       = useExploreStore((s) => s.setPaths);
  const clearPaths     = useExploreStore((s) => s.clearPaths);

  const topics        = useTopicStore((s) => s.topics);
  const taxonomyNodes = useTopicStore((s) => s.taxonomyNodes);

  const [activeTab, setActiveTab] = useState<NavTab>("explore");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [search, setSearch] = useState("");

  const topicCountByNodeId = useMemo(() => {
    const counts = new Map<number, number>();
    for (const t of topics.values()) {
      if (t.taxonomyNodeId !== null) {
        counts.set(t.taxonomyNodeId, (counts.get(t.taxonomyNodeId) ?? 0) + 1);
      }
    }
    return counts;
  }, [topics]);

  const tree = useMemo(
    () => buildTree(taxonomyNodes, topicCountByNodeId),
    [taxonomyNodes, topicCountByNodeId],
  );

  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    const q = search.toLowerCase();
    function filterNode(tn: TreeNode): TreeNode | null {
      if (tn.node.name.toLowerCase().includes(q)) return tn;
      const filteredChildren = tn.children.map(filterNode).filter(Boolean) as TreeNode[];
      if (filteredChildren.length > 0) return { ...tn, children: filteredChildren };
      return null;
    }
    return tree.map(filterNode).filter(Boolean) as TreeNode[];
  }, [tree, search]);

  const toggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleNode = useCallback((tn: TreeNode) => {
    const allPaths = collectDescendantPaths(tn);
    const allChecked = allPaths.every((p) => selectedPaths.has(p));
    const next = new Set(selectedPaths);
    if (allChecked) {
      for (const p of allPaths) next.delete(p);
    } else {
      for (const p of allPaths) next.add(p);
    }
    setPaths(next);
  }, [selectedPaths, setPaths]);

  const activeFilterCount = selectedPaths.size;

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="z-60 w-[280px] p-0 flex flex-col gap-0 bg-background border-r border-border/50"
        style={{ backdropFilter: "blur(16px)" }}
      >
        {/* Header */}
        <SheetHeader className="shrink-0 px-4 h-16 flex-row items-center justify-between border-b border-border/50 space-y-0">
          <SheetTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <Globe size={18} className="text-violet-500" />
            Explore Universe
          </SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            aria-label="Close sidebar"
          >
            <X size={15} />
          </Button>
        </SheetHeader>

        {/* Nav tabs */}
        <div className="shrink-0 px-2 pt-3 pb-2 space-y-0.5">
          <NavItem
            icon={<BookMarked size={15} />}
            label="My Library"
            active={activeTab === "library"}
            onClick={() => setActiveTab("library")}
            disabled
          />
          <NavItem
            icon={<Star size={15} />}
            label="Favorites"
            active={activeTab === "favorites"}
            onClick={() => setActiveTab("favorites")}
            disabled
          />
          <NavItem
            icon={<Globe size={15} />}
            label="Explore All Topics"
            active={activeTab === "explore"}
            onClick={() => setActiveTab("explore")}
          />
        </div>

        <Separator className="mx-3 w-auto" />

        {/* Search + clear */}
        {activeTab === "explore" && (
          <div className="shrink-0 px-3 py-2 flex items-center gap-2">
            <ClearableInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              placeholder="Filter categories…"
              className="h-8 text-[12px]"
            />
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearPaths}
                className="shrink-0 h-8 px-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Clear ({activeFilterCount})
              </Button>
            )}
          </div>
        )}

        {/* Tree body */}
        {activeTab === "explore" && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full px-1 pb-4">
              {filteredTree.length === 0 && (
                <p className="text-center text-[12px] py-8 text-muted-foreground/50">
                  {taxonomyNodes.size === 0 ? "No categories loaded yet" : "No results"}
                </p>
              )}

              {filteredTree.length > 0 && CATEGORY_GROUPS.map((group) => {
                const groupNodes = filteredTree.filter((tn) =>
                  (group.items as readonly string[]).includes(tn.node.name)
                );
                if (groupNodes.length === 0) return null;
                return (
                  <div key={group.label}>
                    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 select-none">
                      {group.label}
                    </p>
                    <TreeSubtree
                      nodes={groupNodes}
                      depth={0}
                      expandedIds={expandedIds}
                      onToggleExpand={toggleExpand}
                      selectedPaths={selectedPaths}
                      onToggleNode={toggleNode}
                    />
                  </div>
                );
              })}
            </ScrollArea>
          </div>
        )}

        {/* Coming-soon placeholder */}
        {activeTab !== "explore" && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[12px] text-muted-foreground/30">Coming soon</p>
          </div>
        )}

        {/* Footer */}
        <Separator />
        <div className="shrink-0 px-4 py-3">
          <p className="text-[10px] text-muted-foreground/30">
            {topics.size.toLocaleString()} topics · {taxonomyNodes.size} categories
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
