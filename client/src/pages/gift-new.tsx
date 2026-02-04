import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, FileText, Presentation, Code, FileJson } from "lucide-react";
import type { Workspace } from "@shared/schema";

const formSchema = z.object({
  workspaceId: z.string().min(1, "Please select a studio"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["pdf", "slides", "document", "code", "data"]),
  prompt: z.string().min(10, "Please provide more detail about what you want"),
  sourceData: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const giftTypes = [
  { value: "pdf", label: "PDF Document", icon: FileText, description: "Professional document with headings and formatting" },
  { value: "slides", label: "Presentation Slides", icon: Presentation, description: "Slide-by-slide presentation content" },
  { value: "document", label: "Research Document", icon: FileText, description: "Comprehensive documentation" },
  { value: "code", label: "Code Snippet", icon: Code, description: "Clean, documented code" },
  { value: "data", label: "Data Analysis", icon: FileJson, description: "Structured data and insights" },
];

export default function GiftNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      workspaceId: "",
      title: "",
      description: "",
      type: "pdf",
      prompt: "",
      sourceData: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const workspace = workspaces?.find(w => w.id === data.workspaceId);
      if (!workspace) throw new Error("Workspace not found");
      
      return apiRequest("POST", `/api/workspaces/${workspace.slug}/gifts`, {
        title: data.title,
        description: data.description,
        type: data.type,
        prompt: data.prompt,
        sourceData: data.sourceData || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      toast({ title: "Gift is being generated!" });
      navigate("/gifts");
    },
    onError: (error) => {
      toast({
        title: "Failed to create gift",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/gifts")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-title">Create Gift</h1>
          <p className="text-muted-foreground">Generate a PDF, presentation, or document</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gift Details</CardTitle>
          <CardDescription>
            Describe what you want the agent to create for you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="workspaceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Studio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-workspace">
                          <SelectValue placeholder="Select a studio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {workspaces?.map((workspace) => (
                          <SelectItem key={workspace.id} value={workspace.id}>
                            {workspace.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Quarterly Report, Project Plan" 
                        data-testid="input-title"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Brief description of the gift" 
                        data-testid="input-description"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {giftTypes.map((type) => {
                        const Icon = type.icon;
                        return (
                          <div
                            key={type.value}
                            className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                              field.value === type.value
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            }`}
                            onClick={() => field.onChange(type.value)}
                            data-testid={`option-type-${type.value}`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">{type.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {type.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what you want in detail. For example: 'Create a professional report about AI trends in 2026, including sections on language models, autonomous agents, and future predictions.'"
                        className="min-h-[120px]"
                        data-testid="input-prompt"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Be specific about the content, structure, and style you want
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sourceData"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Data (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Paste any data or content you want the gift to be based on..."
                        className="min-h-[100px]"
                        data-testid="input-source-data"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Include raw data, notes, or context that should inform the gift
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/gifts")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-create"
                >
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Generate Gift
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
