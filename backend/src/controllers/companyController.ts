import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { getCompany, updateCompany } from "./platformController";

export const getCompanies = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companies = await prisma.company.findMany({
      where: { is_active: true, is_deleted: false },
      select: {
        id: true,
        name: true,
        company_code: true,
      },
    });

    res.status(200).json({
      status: "success",
      results: companies.length,
      data: {
        companies,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyCompany = async (req: Request, res: Response, next: NextFunction) => {
  const companyId = req.user?.company_id;
  if (!companyId) return res.status(401).json({ status: "fail", message: "Company ID not found in session" });

  // Reuse existing logic
  req.params.id = companyId.toString();
  return getCompany(req, res, next);
};

export const updateMyCompany = async (req: Request, res: Response, next: NextFunction) => {
  const companyId = req.user?.company_id;
  if (!companyId) return res.status(401).json({ status: "fail", message: "Company ID not found in session" });

  // Reuse existing logic
  req.params.id = companyId.toString();
  return updateCompany(req, res, next);
};
