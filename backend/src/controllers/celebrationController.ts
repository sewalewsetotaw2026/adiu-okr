/**
 * Celebration Controller
 * Handles HTTP requests for celebration system
 */
import { Request, Response, NextFunction } from "express";
import * as celebrationService from "src/services/celebrationService";

// SSE clients map
const sseClients = new Map<number, Set<Response>>();

// Type for celebration message from service
interface CelebrationMessageData {
  id: number;
  celebration_id: number;
  sender_id: string;
  message: string;
  is_reaction: boolean;
  reaction_type: string | null;
  created_at: Date;
  sender: {
    id: string;
    full_name: string;
    profile_picture_url: string | null;
    employments: Array<{ jobTitle: { title: string } | null }>;
  };
}

// Type for celebration from service
interface CelebrationData {
  id: number;
  employee_id: string;
  type: string;
  visibility: string;
  celebration_date: Date;
  details: unknown;
  employee: {
    id: string;
    full_name: string;
    profile_picture_url: string | null;
    employments: Array<{
      jobTitle: { title: string } | null;
      department: { name: string } | null;
    }>;
  };
  messages: CelebrationMessageData[];
  dismissals: Array<unknown>;
  _count: { messages: number };
}

// Helper to transform backend celebration to frontend format
function transformCelebration(c: CelebrationData) {
  return {
    id: c.id.toString(),
    type: c.type.toLowerCase(),
    employeeId: c.employee_id,
    employeeName: c.employee.full_name,
    employeeAvatar: c.employee.profile_picture_url,
    employeePosition: c.employee.employments?.[0]?.jobTitle?.title,
    employeeDepartment: c.employee.employments?.[0]?.department?.name,
    visibility: c.visibility.toLowerCase(),
    celebrationDate: c.celebration_date.toISOString(),
    details: c.details,
    totalWishes: c._count?.messages || 0,
    totalLikes:
      c.messages?.filter((m: CelebrationMessageData) => m.is_reaction).length ||
      0,
    messages: (c.messages || []).map((m: CelebrationMessageData) => ({
      id: m.id.toString(),
      celebrationId: m.celebration_id.toString(),
      senderId: m.sender_id,
      senderName: m.sender.full_name,
      senderAvatar: m.sender.profile_picture_url,
      senderPosition: m.sender.employments?.[0]?.jobTitle?.title,
      message: m.message,
      isReaction: m.is_reaction,
      reactionType: m.reaction_type,
      createdAt: m.created_at.toISOString(),
    })),
  };
}

/**
 * Get all active celebrations for current user
 */
export async function getCelebrations(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = req.user?.company_id;
    const userId = req.user?.employee_id;

    if (!companyId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Run detection first to ensure today's celebrations are captured
    await celebrationService.runCelebrationDetection(companyId);

    const celebrations = (await celebrationService.getActiveCelebrations(
      companyId,
      userId,
    )) as CelebrationData[];

    // Transform to API response format
    const response = celebrations.map(transformCelebration);

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific celebration by ID
 */
export async function getCelebrationById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const celebration = (await celebrationService.getCelebrationById(
      parseInt(id),
      companyId,
    )) as CelebrationData | null;

    if (!celebration) {
      return res.status(404).json({ error: "Celebration not found" });
    }

    res.status(200).json({
      id: celebration.id.toString(),
      type: celebration.type.toLowerCase(),
      employeeId: celebration.employee_id,
      employeeName: celebration.employee.full_name,
      employeeAvatar: celebration.employee.profile_picture_url,
      employeePosition: celebration.employee.employments[0]?.jobTitle?.title,
      employeeDepartment: celebration.employee.employments[0]?.department?.name,
      visibility: celebration.visibility.toLowerCase(),
      celebrationDate: celebration.celebration_date.toISOString(),
      details: celebration.details,
      totalWishes: celebration._count.messages,
      totalLikes: celebration.messages.filter(
        (m: CelebrationMessageData) => m.is_reaction,
      ).length,
      messages: celebration.messages.map((m: CelebrationMessageData) => ({
        id: m.id.toString(),
        celebrationId: m.celebration_id.toString(),
        senderId: m.sender_id,
        senderName: m.sender.full_name,
        senderAvatar: m.sender.profile_picture_url,
        senderPosition: m.sender.employments[0]?.jobTitle?.title,
        message: m.message,
        isReaction: m.is_reaction,
        reactionType: m.reaction_type,
        createdAt: m.created_at.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Send a message to a celebration
 */
export async function sendMessage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = req.user?.company_id;
    const userId = req.user?.employee_id;
    const { id } = req.params;
    const { message } = req.body;

    if (!companyId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const celebrationMessage = await celebrationService.sendCelebrationMessage(
      parseInt(id),
      userId,
      companyId,
      message.trim(),
    );

    const response = {
      id: celebrationMessage.id.toString(),
      celebrationId: celebrationMessage.celebration_id.toString(),
      senderId: celebrationMessage.sender_id,
      senderName: celebrationMessage.sender.full_name,
      senderAvatar: celebrationMessage.sender.profile_picture_url,
      senderPosition: celebrationMessage.sender.employments[0]?.jobTitle?.title,
      message: celebrationMessage.message,
      createdAt: celebrationMessage.created_at.toISOString(),
    };

    // Broadcast to SSE clients
    broadcastToCompany(companyId, {
      type: "new_message",
      data: response,
    });

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Send a reaction to a celebration
 */
export async function sendReaction(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = req.user?.company_id;
    const userId = req.user?.employee_id;
    const { id } = req.params;
    const { reaction } = req.body;

    if (!companyId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await celebrationService.sendCelebrationMessage(
      parseInt(id),
      userId,
      companyId,
      reaction,
      true,
      reaction,
    );

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * Dismiss a celebration
 */
export async function dismissCelebration(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = req.user?.company_id;
    const userId = req.user?.employee_id;
    const { id } = req.params;

    if (!companyId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const celebrationId = parseInt(id);
    
    // Handle demo/client-side IDs that aren't numbers
    if (isNaN(celebrationId)) {
      return res.status(200).json({ success: true });
    }

    await celebrationService.dismissCelebration(
      celebrationId,
      userId,
      companyId,
    );

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * SSE endpoint for real-time celebration events
 */
export async function sseEventsHandler(req: Request, res: Response) {
  const companyId = req.user?.company_id;

  if (!companyId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Set CORS headers for SSE
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // Add client to company's SSE list
  const companyKey = Number(companyId);
  if (!sseClients.has(companyKey)) {
    sseClients.set(companyKey, new Set());
  }
  sseClients.get(companyKey)!.add(res);
  console.log(
    `[Celebration SSE] Client connected for company ${companyKey}. Total clients: ${sseClients.get(companyKey)!.size}`,
  );

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  // Keep connection alive
  const keepAliveInterval = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 30000);

  // Clean up on disconnect
  req.on("close", () => {
    clearInterval(keepAliveInterval);
    sseClients.get(Number(companyId))?.delete(res);
  });
}

/**
 * Broadcast event to all SSE clients of a company
 */
function broadcastToCompany(
  companyId: number,
  event: { type: string; data: any },
) {
  const companyKey = Number(companyId);
  const clients = sseClients.get(companyKey);
  if (!clients || clients.size === 0) {
    console.log(`[Celebration] No clients connected for company ${companyKey}`);
    return;
  }

  const message = `data: ${JSON.stringify(event)}\n\n`;
  console.log(
    `[Celebration] Broadcasting ${event.type} to ${clients.size} clients in company ${companyKey}`,
  );

  clients.forEach((client) => {
    try {
      client.write(message);
    } catch (error) {
      console.error("[Celebration] Failed to write to client:", error);
      clients.delete(client);
    }
  });
}

/**
 * Broadcast a new celebration to all clients (called when promotion happens, etc.)
 */
export function broadcastNewCelebration(companyId: number, celebration: any) {
  console.log(
    "[Celebration] broadcastNewCelebration called for company:",
    companyId,
  );
  console.log(
    "[Celebration] Celebration data:",
    JSON.stringify(celebration, null, 2),
  );

  const transformed = transformCelebration(celebration);
  console.log(
    "[Celebration] Transformed celebration:",
    JSON.stringify(transformed, null, 2),
  );

  broadcastToCompany(companyId, {
    type: "new_celebration",
    data: transformed,
  });
}

/**
 * Manually trigger celebration detection (admin endpoint)
 */
export async function runDetection(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await celebrationService.runCelebrationDetection(companyId);

    res.status(200).json({
      message: "Celebration detection completed",
      ...result,
    });
  } catch (error) {
    next(error);
  }
}
