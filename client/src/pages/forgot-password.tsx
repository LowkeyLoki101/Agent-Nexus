import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, ArrowLeft, LogIn } from "lucide-react";
import { useLocation } from "wouter";

export default function ForgotPassword() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="page-forgot-password">
      <Card className="w-full max-w-md border-primary/20">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">No Password Needed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pocket Factory uses secure sign-in through Replit — there's no password to forget. Just click "Sign In" and you'll be authenticated automatically through your Replit account.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <a href="/api/login">
              <Button className="w-full gap-2" data-testid="button-sign-in">
                <LogIn className="h-4 w-4" />
                Sign In with Replit
              </Button>
            </a>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => navigate("/")}
              data-testid="button-go-home"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
