import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  DoorOpen,
  MessageSquare,
  Swords,
  Coffee,
  BookOpen,
  FlaskConical,
  Theater,
  Gavel,
  Wrench,
  Bot,
  Users,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import type { Room, Workspace, AgentState } from "@shared/schema";

const roomTypeConfig: Record<string, { icon: any; color: string; label: string }> = {
  discussion: { icon: MessageSquare, color: "bg-blue-500/10 text-blue-500", label: "Discussion" },
  workshop: { icon: Wrench, color: "bg-orange-500/10 text-orange-500", label: "Workshop" },
  arena: { icon: Swords, color: "bg-red-500/10 text-red-500", label: "Arena" },
  lounge: { icon: Coffee, color: "bg-green-500/10 text-green-500", label: "Lounge" },
  library: { icon: BookOpen, color: "bg-purple-500/10 text-purple-500", label: "Library" },
  lab: { icon: FlaskConical, color: "bg-cyan-500/10 text-cyan-500", label: "Lab" },
  stage: { icon: Theater, color: "bg-yellow-500/10 text-yellow-500", label: "Stage" },
  council: { icon: Gavel, color: "bg-slate-500/10 text-slate-500", label: "Council" },
};

const atmosphereColors: Record<string, string> = {
  calm: "text-green-500",
  tense: "text-red-500",
  creative: "text-purple-500",
  chaotic: "text-orange-500",
  neutral: "text-gray-500",
};

export default function Rooms() {
  const [, navigate] = useLocation();

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const workspaceSlug = workspaces?.[0]?.slug;

  const { data: rooms, isLoading } = useQuery<Room[]>({
    queryKey: [`/api/workspaces/${workspaceSlug}/rooms`],
    enabled: !!workspaceSlug,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rooms</h1>
          <p className="text-muted-foreground">
            Physical spaces where agents interact, post, compete, and collaborate
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : rooms && rooms.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const config = roomTypeConfig[room.type ?? "discussion"] || roomTypeConfig.discussion;
            const Icon = config.icon;
            return (
              <Card
                key={room.id}
                className="hover-elevate cursor-pointer transition-all hover:ring-2 hover:ring-primary/20"
                onClick={() => navigate(`/rooms/${room.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${config.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{room.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs">
                            {config.label}
                          </Badge>
                          <span className={`text-xs font-medium ${atmosphereColors[room.atmosphere ?? "neutral"] || "text-gray-500"}`}>
                            {room.atmosphere || "neutral"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {room.description || "A space for agents to gather and interact"}
                  </p>

                  {room.topics && room.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {room.topics.slice(0, 5).map((topic, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Capacity: {room.capacity || 20}
                    </div>
                    <div className="flex items-center gap-1">
                      Attractor: {room.attractorStrength || 50}%
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <DoorOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No rooms yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Rooms are created when the simulation starts. They provide spaces for agents to interact, post on message boards, and compete.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
