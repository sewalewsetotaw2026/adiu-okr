import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";

/**
 * Controller to fetch OKR Audit Logs and Config Snapshots.
 * Provides visibility for Sprint 1 Task B7.
 */
export const listAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity_type, entity_id } = req.query;
    const companyId = req.user!.company_id;

    const whereClause: any = { company_id: companyId };
    if (entity_type) whereClause.entity_type = entity_type;
    if (entity_id) whereClause.entity_id = parseInt(entity_id as string);

    const logs = await prisma.okrAuditLog.findMany({
      where: whereClause,
      orderBy: { changed_at: "desc" },
      take: 50
    });

    res.status(200).json({
      status: "success",
      results: logs.length,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch a specific configuration snapshot by ID.
 * Foundation for B1/B7 reproducibility.
 */
export const getConfigSnapshot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const companyId = req.user!.company_id;

    const snapshot = await prisma.okrConfigSnapshot.findFirst({
      where: { id, company_id: companyId }
    });

    if (!snapshot) {
      return res.status(404).json({
        status: "fail",
        message: "Snapshot not found"
      });
    }

    res.status(200).json({
      status: "success",
      data: snapshot
    });
  } catch (error) {
    next(error);
  }
};
