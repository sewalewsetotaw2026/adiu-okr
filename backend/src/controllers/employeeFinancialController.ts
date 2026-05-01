import { Request, Response, NextFunction } from "express";
import prisma from "src/prisma";
import { redisService } from "src/services/redisService";

export const updateFinancialDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = (req as any).user?.company_id;

    if (!companyId) {
      return res.status(400).json({ status: "fail", message: "Company ID missing" });
    }

    const {
      gross_salary,
      basic_salary,
      allowances,
      bank_account_number,
      bank_name,
      tin_number, // Sometimes financial updates include TIN
      salary
    } = req.body;

    // Resolve salary fields
    const finalGross = gross_salary !== undefined ? gross_salary : salary?.gross;
    const finalBasic = basic_salary !== undefined ? basic_salary : salary?.basic;

    // Resolve allowances
    const rawAllowances = allowances || req.body.custom_allowances || salary?.allowances || salary?.custom_allowances || [];
    const combinedAllowances = [...(Array.isArray(rawAllowances) ? rawAllowances : [])];

    // Helper to add named allowance
    const addNamedAllowance = (name: string, val: any) => {
      if (val && parseFloat(val) > 0) {
        combinedAllowances.push({ name, amount: val });
      }
    };

    if (salary) {
      addNamedAllowance("Transport Allowance", salary.transport);
      addNamedAllowance("Housing Allowance", salary.housing);
      addNamedAllowance("Meal Allowance", salary.meal);
    }
    // Also check top-level legacy fields if sent
    addNamedAllowance("Transport Allowance", req.body.transport);
    addNamedAllowance("Housing Allowance", req.body.housing);
    addNamedAllowance("Meal Allowance", req.body.meal);

    await prisma.$transaction(async (tx) => {
      // 1. Update Core Employee Financials (Bank, TIN if passed here)
      if (bank_account_number !== undefined || bank_name !== undefined || tin_number !== undefined) {
        await tx.employee.update({
          where: { id_company_id: { id, company_id: companyId } },
          data: {
            ...(bank_account_number !== undefined && { bank_account_number }),
            ...(bank_name !== undefined && { bank_name }),
            ...(tin_number !== undefined && { tin_number })
          }
        });
      }

      // 2. Update Employment Salary & Allowances
      if (finalGross !== undefined || finalBasic !== undefined || combinedAllowances.length > 0) {
        const activeEmployment = await tx.employment.findFirst({
          where: { employee_id: id, company_id: companyId, is_active: true }
        });

        if (activeEmployment) {
          // Update Salary
          if (finalGross !== undefined || finalBasic !== undefined) {
            await tx.employment.update({
              where: { id: activeEmployment.id },
              data: {
                ...(finalGross !== undefined && { gross_salary: parseFloat(finalGross) }),
                ...(finalBasic !== undefined && { basic_salary: parseFloat(finalBasic) })
              }
            });
          }

          // Replace Allowances
          if (combinedAllowances.length > 0) {
            await tx.employeeAllowance.deleteMany({
              where: { employment_id: activeEmployment.id }
            });

            for (const al of combinedAllowances) {
              const amount = parseFloat(al.amount);
              if (amount > 0) {
                const typeName = al.name || al.allowanceTypeName;
                if (!typeName) continue;

                const type = await tx.allowanceType.upsert({
                  where: { name: typeName },
                  update: {},
                  create: { name: typeName }
                });

                await tx.employeeAllowance.create({
                  data: {
                    employment_id: activeEmployment.id,
                    allowance_type_id: type.id,
                    amount: amount
                  }
                });
              }
            }
          }
        }
      }
    });

    res.status(200).json({ status: "success", message: "Financial details updated" });
  } catch (error) {
    next(error);
  }
};
