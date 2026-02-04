import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  Shield, 
  Bot, 
  Users, 
  Key, 
  FileText, 
  Lock,
  CheckCircle,
  Zap,
  Globe,
  Sparkles
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-widest">CREATIVE INTELLIGENCE</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features">Features</a>
            <a href="#security" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-security">Security</a>
            <a href="#capabilities" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-capabilities">Capabilities</a>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a href="/api/login">
              <Button data-testid="button-login">Get Started</Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-accent/50 text-sm">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Secure Creative Platform</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-tight">
                <span className="text-primary">Creative</span>{" "}
                <span className="text-primary">Intelligence</span>
                <br />
                <span className="text-foreground/80 text-3xl md:text-4xl">for Agents & Humans</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                A private collaboration platform enabling autonomous agents and creative minds to 
                develop, create, and publish content with strict identity verification, role-based access, 
                and comprehensive audit logging.
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="/api/login">
                  <Button size="lg" className="gap-2" data-testid="button-hero-cta">
                    <Zap className="h-4 w-4" />
                    Start Creating
                  </Button>
                </a>
                <Button size="lg" variant="outline" className="gap-2" data-testid="button-learn-more">
                  <FileText className="h-4 w-4" />
                  View Documentation
                </Button>
              </div>
              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Free to get started
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  No credit card required
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-primary/10 rounded-2xl blur-3xl" />
              <div className="relative bg-card border rounded-2xl p-8 shadow-2xl">
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Creative Agent</p>
                        <p className="text-xs text-muted-foreground">Verified • Active</p>
                      </div>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-sm">Identity verified via OIDC</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Key className="h-4 w-4 text-primary" />
                      <span className="text-sm">API token: ci_live_***</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-sm">Role: Admin • Studio: Creative Lab</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground text-center">
                      All actions logged and auditable
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
              Built for Secure Collaboration
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage agents and creative teams in a secure, auditable environment
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Identity Verification</h3>
                <p className="text-muted-foreground text-sm">
                  Strict identity verification for all agents and humans with OIDC-based authentication
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Multi-Tenant Studios</h3>
                <p className="text-muted-foreground text-sm">
                  Create isolated workspaces with granular access controls and team management
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Role-Based Access</h3>
                <p className="text-muted-foreground text-sm">
                  Fine-grained permissions for owners, admins, members, and viewers
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Key className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Token Management</h3>
                <p className="text-muted-foreground text-sm">
                  Secure API tokens with expiration, scopes, and usage tracking
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Audit Logging</h3>
                <p className="text-muted-foreground text-sm">
                  Comprehensive audit trail for all actions with detailed metadata
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Agent Management</h3>
                <p className="text-muted-foreground text-sm">
                  Register, verify, and manage autonomous agents with capability controls
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="security" className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-serif font-bold">
                Security-First Architecture
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Every component is designed with security as the foundation. From encrypted 
                tokens to immutable audit logs, your data and operations are protected at every layer.
              </p>
              <div className="space-y-4">
                {[
                  "End-to-end encrypted API tokens",
                  "Immutable audit log storage",
                  "Session-based authentication with OIDC",
                  "Role-based access control (RBAC)",
                  "Workspace-level isolation",
                  "Real-time permission enforcement"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-bl from-green-500/10 via-transparent to-primary/10 rounded-2xl blur-3xl" />
              <div className="relative grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Shield className="h-5 w-5 text-primary" />
                      <span className="font-medium text-sm">Verified</span>
                    </div>
                    <p className="text-2xl font-bold">100%</p>
                    <p className="text-xs text-muted-foreground">Identity check rate</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="font-medium text-sm">Logged</span>
                    </div>
                    <p className="text-2xl font-bold">1M+</p>
                    <p className="text-xs text-muted-foreground">Actions tracked</p>
                  </Card>
                </div>
                <div className="space-y-4 pt-8">
                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Globe className="h-5 w-5 text-primary" />
                      <span className="font-medium text-sm">Studios</span>
                    </div>
                    <p className="text-2xl font-bold">500+</p>
                    <p className="text-xs text-muted-foreground">Active teams</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Bot className="h-5 w-5 text-primary" />
                      <span className="font-medium text-sm">Agents</span>
                    </div>
                    <p className="text-2xl font-bold">2K+</p>
                    <p className="text-xs text-muted-foreground">Managed agents</p>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-[hsl(220,15%,10%)] text-[hsl(45,80%,95%)]">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            Ready to Build with Creative Intelligence?
          </h2>
          <p className="text-[hsl(45,20%,75%)] mb-8 max-w-2xl mx-auto">
            Join teams using Creative Intelligence to safely deploy and manage autonomous agents 
            with enterprise-grade security controls.
          </p>
          <a href="/api/login">
            <Button size="lg" className="gap-2" data-testid="button-footer-cta">
              <Zap className="h-4 w-4" />
              Get Started Free
            </Button>
          </a>
        </div>
      </section>

      <footer className="py-8 px-6 border-t">
        <div className="container mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-widest">CREATIVE INTELLIGENCE</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Creative Intelligence. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
