import { Response } from "express";

/**
 * SSE Connection Manager
 * Manages Server-Sent Events connections for real-time notifications
 */

interface SSEClient {
  id: string;
  employeeId: string;
  companyId: number;
  response: Response;
  lastHeartbeat: Date;
}

class SSEConnectionManager {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start heartbeat check every 30 seconds
    this.startHeartbeatCheck();
  }

  /**
   * Add a new SSE client connection
   */
  addClient(
    clientId: string,
    employeeId: string,
    companyId: number,
    response: Response,
    origin?: string,
  ): void {
    // Set SSE headers with CORS support
    const headers: Record<string, string> = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    };

    // Add CORS headers if origin is provided
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Credentials"] = "true";
    }

    response.writeHead(200, headers);

    // Send initial connection event
    response.write(
      `data: ${JSON.stringify({ type: "connected", clientId })}\n\n`,
    );

    const client: SSEClient = {
      id: clientId,
      employeeId,
      companyId,
      response,
      lastHeartbeat: new Date(),
    };

    this.clients.set(clientId, client);

    console.log(
      `[SSE] Client ${clientId} connected for employee ${employeeId}. Total clients: ${this.clients.size}`,
    );
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    console.log(
      `[SSE] Client ${clientId} disconnected. Total clients: ${this.clients.size}`,
    );
  }

  /**
   * Send notification to a specific employee
   */
  sendToEmployee(
    employeeId: string,
    companyId: number,
    notification: any,
  ): void {
    let sent = 0;
    this.clients.forEach((client) => {
      if (client.employeeId === employeeId && client.companyId === companyId) {
        try {
          client.response.write(
            `data: ${JSON.stringify({ type: "notification", data: notification })}\n\n`,
          );
          sent++;
        } catch (error) {
          console.error(`[SSE] Error sending to client ${client.id}:`, error);
          this.removeClient(client.id);
        }
      }
    });

    if (sent > 0) {
      console.log(
        `[SSE] Sent notification to ${sent} connection(s) for employee ${employeeId}`,
      );
    }
  }

  /**
   * Send unread count update to a specific employee
   */
  sendUnreadCountUpdate(
    employeeId: string,
    companyId: number,
    count: number,
  ): void {
    this.clients.forEach((client) => {
      if (client.employeeId === employeeId && client.companyId === companyId) {
        try {
          client.response.write(
            `data: ${JSON.stringify({ type: "unread_count", count })}\n\n`,
          );
        } catch (error) {
          console.error(
            `[SSE] Error sending count update to client ${client.id}:`,
            error,
          );
          this.removeClient(client.id);
        }
      }
    });
  }

  /**
   * Send heartbeat to all clients
   */
  private sendHeartbeat(): void {
    const now = new Date();
    this.clients.forEach((client) => {
      try {
        client.response.write(`: heartbeat ${now.toISOString()}\n\n`);
        client.lastHeartbeat = now;
      } catch (error) {
        console.error(
          `[SSE] Heartbeat failed for client ${client.id}, removing`,
        );
        this.removeClient(client.id);
      }
    });
  }

  /**
   * Start periodic heartbeat check
   */
  private startHeartbeatCheck(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // 30 seconds
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get connected clients for an employee
   */
  getEmployeeClients(employeeId: string): number {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.employeeId === employeeId) count++;
    });
    return count;
  }

  /**
   * Cleanup - call on server shutdown
   */
  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.clients.forEach((client) => {
      try {
        client.response.end();
      } catch (e) {
        // Ignore
      }
    });
    this.clients.clear();
    console.log("[SSE] Connection manager cleaned up");
  }
}

// Singleton instance
export const sseManager = new SSEConnectionManager();

// Helper function to broadcast notification after creation
export const broadcastNotification = (
  employeeId: string,
  companyId: number,
  notification: any,
): void => {
  sseManager.sendToEmployee(employeeId, companyId, notification);
};

export const broadcastUnreadCount = (
  employeeId: string,
  companyId: number,
  count: number,
): void => {
  sseManager.sendUnreadCountUpdate(employeeId, companyId, count);
};
