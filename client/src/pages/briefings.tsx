import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  FileText,
  Search,
  Clock,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { useState } from "react";
import type { Briefing } from "@shared/schema";

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  published: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  archived: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function Briefings() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: briefings, isLoading } = useQuery<Briefing[]>({
    queryKey: ["/api/briefings"],
  });

  const filteredBriefings = briefings?.filter((briefing) =>
    briefing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    briefing.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    briefing.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-briefings-title">
            Briefings
          </h1>
          <p className="text-muted-foreground">
            Create and manage creative briefings for your studios
          </p>
        </div>
        <Link href="/briefings/new">
          <Button className="gap-2" data-testid="button-create-briefing">
            <Plus className="h-4 w-4" />
            Create Briefing
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search briefings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-briefings"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredBriefings && filteredBriefings.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredBriefings.map((briefing) => (
            <Link key={briefing.id} href={`/briefings/${briefing.id}`}>
              <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-briefing-${briefing.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{briefing.title}</CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs ${statusColors[briefing.status] || ""}`} variant="outline">
                          {briefing.status}
                        </Badge>
                        <Badge className={`text-xs ${priorityColors[briefing.priority] || ""}`} variant="outline">
                          {briefing.priority}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0" onClick={(e) => e.preventDefault()}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {briefing.summary || briefing.content.slice(0, 150)}
                  </p>
                  {briefing.tags && briefing.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {briefing.tags.slice(0, 4).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {briefing.tags.length > 4 && (
                        <Badge variant="secondary" className="text-xs">
                          +{briefing.tags.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-4 pt-2 border-t text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      <span>{briefing.createdAt ? new Date(briefing.createdAt).toLocaleDateString() : "recently"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? "No matching briefings" : "No briefings yet"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Create your first briefing to share creative direction with your team and agents"
                }
              </p>
              {!searchQuery && (
                <Link href="/briefings/new">
                  <Button className="gap-2" data-testid="button-create-first-briefing">
                    <Plus className="h-4 w-4" />
                    Create your first briefing
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
