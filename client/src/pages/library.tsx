import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, File, Search, ChevronRight, ChevronDown } from "lucide-react";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  children?: FileNode[];
}

interface FileContent {
  path: string;
  content: string;
  size: number;
  extension: string;
}

function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function filterTree(nodes: FileNode[], query: string): FileNode[] {
  if (!query) return nodes;
  const lower = query.toLowerCase();
  return nodes.reduce<FileNode[]>((acc, node) => {
    if (node.type === "file") {
      if (node.name.toLowerCase().includes(lower)) acc.push(node);
    } else {
      const filtered = filterTree(node.children || [], query);
      if (filtered.length > 0 || node.name.toLowerCase().includes(lower)) {
        acc.push({ ...node, children: filtered });
      }
    }
    return acc;
  }, []);
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
  expandedDirs,
  onToggleDir,
}: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
}) {
  const isDir = node.type === "directory";
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = selectedPath === node.path;

  return (
    <div>
      <button
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-sm rounded-md text-left transition-colors ${
          isSelected ? "bg-accent text-accent-foreground" : "hover-elevate"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (isDir) {
            onToggleDir(node.path);
          } else {
            onSelect(node.path);
          }
        }}
        data-testid={isDir ? `button-folder-${node.path}` : `button-file-${node.path}`}
      >
        {isDir ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <File className="h-4 w-4 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="truncate">{node.name}</span>
        {node.size !== undefined && node.type === "file" && (
          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{formatSize(node.size)}</span>
        )}
      </button>
      {isDir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expandedDirs={expandedDirs}
              onToggleDir={onToggleDir}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Library() {
  const [search, setSearch] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const { data: files, isLoading: filesLoading } = useQuery<FileNode[]>({
    queryKey: ["/api/library/files"],
  });

  const { data: fileContent, isLoading: contentLoading } = useQuery<FileContent>({
    queryKey: ["/api/library/file", selectedPath],
    queryFn: async () => {
      const res = await fetch(`/api/library/file?path=${encodeURIComponent(selectedPath!)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch file");
      return res.json();
    },
    enabled: !!selectedPath,
  });

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const filteredFiles = filterTree(files || [], search);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-library-title">Library</h1>
        <p className="text-muted-foreground text-sm">Read-only access to the project file architecture</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter files by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-files"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              File Tree
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto p-2">
            {filesLoading && (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            )}
            {!filesLoading && filteredFiles.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-files">
                No files found
              </p>
            )}
            {!filesLoading &&
              filteredFiles.map((node) => (
                <TreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  selectedPath={selectedPath}
                  onSelect={setSelectedPath}
                  expandedDirs={expandedDirs}
                  onToggleDir={toggleDir}
                />
              ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <File className="h-4 w-4" />
              File Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedPath && (
              <div className="text-center py-16">
                <File className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground" data-testid="text-no-selection">
                  Select a file from the tree to preview its contents
                </p>
              </div>
            )}
            {selectedPath && contentLoading && (
              <div className="space-y-3">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-[400px] w-full" />
              </div>
            )}
            {selectedPath && fileContent && !contentLoading && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs" data-testid="badge-file-path">
                    {fileContent.path}
                  </Badge>
                  {fileContent.extension && (
                    <Badge variant="secondary" className="text-xs" data-testid="badge-file-extension">
                      .{fileContent.extension}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs" data-testid="badge-file-size">
                    {formatSize(fileContent.size)}
                  </Badge>
                </div>
                <pre
                  className="rounded-md bg-zinc-950 text-zinc-100 p-4 text-xs font-mono overflow-auto max-h-[500px] whitespace-pre-wrap break-words"
                  data-testid="code-preview"
                >
                  {fileContent.content}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
