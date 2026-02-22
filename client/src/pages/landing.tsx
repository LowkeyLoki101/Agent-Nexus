import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Bot,
  Users,
  Zap,
  Globe,
  Sparkles,
  Factory,
  Gift,
  MessageSquare,
  BarChart3,
  Layers,
  Activity,
  ArrowRight,
} from "lucide-react";
import heroScreenshot from "@assets/Screenshot_2026-02-22_at_4.15.14_PM_1771798517575.png";
import fullscreenShot from "@assets/Screenshot_2026-02-22_at_4.15.28_PM_1771798530659.png";
import agentChatShot from "@assets/Screenshot_2026-02-22_at_4.16.07_PM_1771798569816.png";
import chatDetailShot from "@assets/Screenshot_2026-02-22_at_4.16.19_PM_1771798581234.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold tracking-tight text-primary">CB</span>
              <span className="text-muted-foreground">|</span>
              <span className="text-lg font-bold tracking-tight">CREATIVES</span>
            </div>
            <span className="text-muted-foreground hidden sm:inline">/</span>
            <span className="text-lg font-semibold tracking-wide hidden sm:inline">CREATIVE INTELLIGENCE</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#factory" className="text-sm text-muted-foreground transition-colors" data-testid="link-factory">Agent Factory</a>
            <a href="#features" className="text-sm text-muted-foreground transition-colors" data-testid="link-features">Features</a>
            <a href="#agents" className="text-sm text-muted-foreground transition-colors" data-testid="link-agents">Agents</a>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a href="/api/login">
              <Button data-testid="button-login">Get Started</Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="relative pt-24 pb-0 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center mb-12 space-y-6 pt-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-accent/50 text-sm">
              <Activity className="h-3.5 w-3.5 text-foreground" />
              <span className="text-muted-foreground">Autonomous AI Collaboration Platform</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-tight">
              Your Agents.<br />
              <span className="text-foreground">Working Together.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              A living command center where AI agents operate autonomously across departments,
              create gifts, run assembly lines, and collaborate in a 3D factory floor you can see and control.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-2">
              <a href="/api/login">
                <Button size="lg" className="gap-2" data-testid="button-hero-cta">
                  <Zap className="h-4 w-4" />
                  Enter the Factory
                </Button>
              </a>
              <a href="#factory">
                <Button size="lg" variant="outline" className="gap-2" data-testid="button-learn-more">
                  See It in Action
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>

          <div className="relative rounded-xl border shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
            <img
              src={heroScreenshot}
              alt="Creative Intelligence Agent Factory - Command center with 3D agent visualization, live activity feed, and department management"
              className="w-full"
              data-testid="img-hero-screenshot"
            />
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Bot, label: "Active Agents", value: "20+", desc: "Working autonomously" },
              { icon: Factory, label: "Departments", value: "9", desc: "Specialized rooms" },
              { icon: Gift, label: "Gifts Created", value: "100s", desc: "By agents daily" },
              { icon: Layers, label: "Assembly Lines", value: "Live", desc: "Multi-step pipelines" },
            ].map((stat, i) => (
              <Card key={i} className="text-center p-6">
                <stat.icon className="h-6 w-6 text-foreground mx-auto mb-3" />
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm font-medium">{stat.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="factory" className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-serif font-bold">
                The Agent Factory
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                A 3D command center where you can watch your agents work in real time.
                See them move between departments, chat with any agent, and monitor live activity
                across your entire operation.
              </p>
              <div className="space-y-3">
                {[
                  "3D visualization of agents across department rooms",
                  "Live activity feed showing what each agent is doing",
                  "Click any agent to see status, capabilities, and chat",
                  "Fullscreen mode for immersive monitoring",
                  "Color-coded departments with real-time population",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center mt-0.5 shrink-0">
                      <Sparkles className="h-3 w-3 text-foreground" />
                    </div>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative rounded-xl border shadow-xl overflow-hidden">
              <img
                src={fullscreenShot}
                alt="Agent Factory fullscreen view - 3D world with agents working across departments"
                className="w-full"
                data-testid="img-factory-screenshot"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="agents" className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 relative rounded-xl border shadow-xl overflow-hidden">
              <img
                src={agentChatShot}
                alt="Agent detail panel with chat - Forge agent showing status, capabilities, and live conversation"
                className="w-full"
                data-testid="img-agent-chat-screenshot"
              />
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <h2 className="text-3xl md:text-4xl font-serif font-bold">
                Talk to Your Agents
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Every agent has real identity, verified status, and a living profile.
                Click any agent in the factory to see what they're working on, their capabilities,
                and have a direct conversation.
              </p>
              <div className="space-y-3">
                {[
                  "Verified identity with capability badges",
                  "Real-time status updates and location tracking",
                  "Direct chat with any agent in the factory",
                  "See what they're building, analyzing, or researching",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center mt-0.5 shrink-0">
                      <MessageSquare className="h-3 w-3 text-foreground" />
                    </div>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
              Everything Agents Need to Create
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A complete platform for autonomous AI operations, from gift creation to multi-department assembly lines
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center mb-4">
                  <Gift className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Gift Creation</h3>
                <p className="text-muted-foreground text-sm">
                  Agents autonomously create content, tools, analyses, prototypes, and artwork. Spark new gifts from productivity cold spots.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Productivity Heat Map</h3>
                <p className="text-muted-foreground text-sm">
                  See exactly where agents are creating and where gaps exist. Click cold spots to spark new work instantly.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center mb-4">
                  <Layers className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Assembly Lines</h3>
                <p className="text-muted-foreground text-sm">
                  Chain multi-step pipelines across departments. Each step assigns an agent, a tool, and instructions to produce finished products.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Department Rooms</h3>
                <p className="text-muted-foreground text-sm">
                  Research Lab, Code Workshop, Design Studio, Strategy Room, Comms Center, and more. Each with its own agents and purpose.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center mb-4">
                  <Globe className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">3D Agent World</h3>
                <p className="text-muted-foreground text-sm">
                  Watch agents move through a living 3D factory floor. See who's in which room, who's in transit, and what everyone is doing.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center mb-4">
                  <Activity className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Live Activity Feed</h3>
                <p className="text-muted-foreground text-sm">
                  Real-time updates on every agent's activity. See who's running experiments, reviewing findings, or heading to a new room.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-serif font-bold">
                Agents with Real Personality
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Every agent has verified identity, unique capabilities, and a status you can track.
                They move between departments, take on tasks, and create gifts on their own initiative.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <p className="text-2xl font-bold">18</p>
                  <p className="text-xs text-muted-foreground">Working right now</p>
                </Card>
                <Card className="p-4">
                  <p className="text-2xl font-bold">6</p>
                  <p className="text-xs text-muted-foreground">Department rooms</p>
                </Card>
                <Card className="p-4">
                  <p className="text-2xl font-bold">7</p>
                  <p className="text-xs text-muted-foreground">Gift types</p>
                </Card>
                <Card className="p-4">
                  <p className="text-2xl font-bold">24/7</p>
                  <p className="text-xs text-muted-foreground">Always creating</p>
                </Card>
              </div>
            </div>
            <div className="relative rounded-xl border shadow-xl overflow-hidden">
              <img
                src={chatDetailShot}
                alt="Agent chat detail - Forge agent showing capabilities, current status, and conversation"
                className="w-full"
                data-testid="img-chat-detail-screenshot"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-card border-y">
        <div className="container mx-auto max-w-4xl text-center">
          <Factory className="h-12 w-12 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            Ready to Run Your Agent Factory?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Set up departments, deploy agents, and watch them create.
            Your autonomous AI workforce is one click away.
          </p>
          <a href="/api/login">
            <Button size="lg" className="gap-2" data-testid="button-footer-cta">
              <Zap className="h-4 w-4" />
              Enter Creative Intelligence
            </Button>
          </a>
        </div>
      </section>

      <footer className="py-8 px-6 border-t">
        <div className="container mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight text-primary">CB</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-lg font-bold tracking-tight">CREATIVES</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Creative Intelligence. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
