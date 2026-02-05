import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

export interface AgentAuthRequest extends Request {
  agentAuth?: {
    token: any;
    agent: any;
    workspaceId: string;
    agentId?: string;
    userId: string;
  };
}

export async function agentTokenAuth(
  req: AgentAuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid authorization header" });
  }
  
  const token = authHeader.substring(7);
  
  if (!token.startsWith("ahub_")) {
    return res.status(401).json({ message: "Invalid token format" });
  }
  
  try {
    const result = await storage.validateApiToken(token);
    
    if (!result) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    
    req.agentAuth = {
      token: result.token,
      agent: result.agent,
      workspaceId: result.token.workspaceId,
      agentId: result.token.agentId || undefined,
      userId: result.token.createdById,
    };
    
    next();
  } catch (error) {
    console.error("Agent auth error:", error);
    return res.status(500).json({ message: "Authentication error" });
  }
}

export function requireAgentPermission(...permissions: string[]) {
  return (req: AgentAuthRequest, res: Response, next: NextFunction) => {
    if (!req.agentAuth) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const tokenPermissions = req.agentAuth.token.permissions || [];
    
    if (permissions.length === 0) {
      return next();
    }
    
    const hasPermission = permissions.some(p => tokenPermissions.includes(p) || tokenPermissions.includes("*"));
    
    if (!hasPermission) {
      return res.status(403).json({ 
        message: "Insufficient permissions",
        required: permissions,
        granted: tokenPermissions
      });
    }
    
    next();
  };
}
