import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GraduationCap, BookOpen, Loader2, Clock, CheckCircle, XCircle, Bot, ArrowRight } from "lucide-react";
import { useState } from "react";
import type { Agent } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MarkdownMessage } from "@/components/markdown-message";

export default function University() {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");

  const { data: agents } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: sessions, isLoading } = useQuery<any[]>({ queryKey: ["/api/university/sessions"] });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/university/enroll", {
        studentAgentId: selectedAgent,
        subject: subject || "general improvement",
        teacherAgentId: selectedTeacher || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/sessions"] });
      toast({ title: "Enrolled", description: "Agent has been sent to university. Results will appear shortly." });
      setSubject("");
      setSelectedAgent("");
      setSelectedTeacher("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const activeAgents = agents?.filter(a => a.isActive) || [];
  const potentialTeachers = agents?.filter(a => a.isActive && a.id !== selectedAgent) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2" data-testid="text-university-title">
          <GraduationCap className="h-6 w-6" /> University
        </h1>
        <p className="text-muted-foreground">
          Intelligence siphoning — send agents to learn from stronger models or more experienced agents
        </p>
      </div>

      <Card data-testid="card-enroll">
        <CardHeader>
          <CardTitle className="text-lg">Enroll an Agent</CardTitle>
          <CardDescription>Choose a student, optionally pick a teacher agent, and specify what they need help with</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-sm">Student Agent</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger data-testid="select-student-agent">
                  <SelectValue placeholder="Select agent..." />
                </SelectTrigger>
                <SelectContent>
                  {activeAgents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Teacher (optional)</Label>
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger data-testid="select-teacher-agent">
                  <SelectValue placeholder="Cloud model (GPT-4o)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cloud">Cloud Professor (GPT-4o)</SelectItem>
                  {potentialTeachers.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} {a.generation ? `(Gen ${a.generation})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Subject</Label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. writing depth, code quality"
                data-testid="input-university-subject"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => enrollMutation.mutate()}
                disabled={!selectedAgent || enrollMutation.isPending}
                className="w-full"
                data-testid="button-enroll"
              >
                {enrollMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GraduationCap className="h-4 w-4 mr-2" />}
                {enrollMutation.isPending ? "Enrolling..." : "Send to Class"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-medium mb-4">Session History</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i}><CardContent className="py-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((session: any) => {
              const studentAgent = agents?.find(a => a.id === session.studentAgentId);
              const teacherAgent = session.teacherAgentId ? agents?.find(a => a.id === session.teacherAgentId) : null;

              return (
                <Card key={session.id} data-testid={`card-session-${session.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center gap-2 min-w-[200px]">
                        <Bot className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">{studentAgent?.name || "Unknown Agent"}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" />
                            {teacherAgent ? teacherAgent.name : session.teacherModel || "Cloud Professor"}
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            <BookOpen className="h-3 w-3 mr-1" /> {session.subject}
                          </Badge>
                          <Badge
                            variant={session.status === "completed" ? "default" : session.status === "failed" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {session.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                            {session.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                            {session.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                            {session.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {session.createdAt ? new Date(session.createdAt).toLocaleString() : ""}
                          </span>
                        </div>
                        {session.enhancedWork && (
                          <div className="mt-2 p-3 rounded-lg bg-muted/50 text-sm">
                            <div className="text-xs font-medium text-muted-foreground mb-1">Takeaways:</div>
                            <MarkdownMessage content={session.enhancedWork} />
                          </div>
                        )}
                        {session.teacherFeedback && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">View full teacher feedback</summary>
                            <div className="mt-1 p-3 rounded-lg bg-muted/30 text-sm">
                              <MarkdownMessage content={session.teacherFeedback} />
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">No sessions yet</h3>
              <p className="text-sm text-muted-foreground">Enroll an agent above to start intelligence siphoning</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
