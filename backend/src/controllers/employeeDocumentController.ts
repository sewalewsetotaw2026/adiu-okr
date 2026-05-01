import { Request, Response, NextFunction } from "express";
import prisma from "src/prisma";
import { redisService } from "src/services/redisService";


export const replaceEmployeeDocuments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = (req as any).user?.company_id;
    if (!companyId) return res.status(400).json({ status: "fail", message: "Company ID missing" });

    const { documents } = req.body;

    if (documents) {
      const userRoleId = (req as any).user?.role_id;

      // Initialize payload with all document categories
      let payload: any = {
        cv: [],
        national_id: [],
        guarantee_letter: [],
        medical_certificate: [],
        police_certificate: [],
        certificates: [],
        photo: [],
        experienceLetters: [],
        taxForms: [],
        pensionForms: [],
      };

      // 1. Map incoming documents to payload
      if (Array.isArray(documents)) {
        // Handle flat array format: [{ type: 'cv', url: '...' }]
        documents.forEach((doc: any) => {
          const type = doc.type || doc.document_type;
          const url = doc.url || doc.document_url || (typeof doc === 'string' ? doc : null);
          if (type && url && payload[type] !== undefined) {
            payload[type].push(url);
          } else if (!type && typeof doc === 'string') {
            // Fallback if just an array of strings passed? (Rare for this schema)
          }
        });
      } else if (typeof documents === 'object') {
        // Handle object format: { cv: [...], national_id: [...] }
        Object.keys(payload).forEach(key => {
          payload[key] = documents[key] || documents[key.replace(/([A-Z])/g, '_$1').toLowerCase()] || [];
        });
      }

      // 2. Strict enforcement: Employees cannot remove existing documents
      if (userRoleId === 3) {
        const existingDocs = await prisma.employeeDocument.findUnique({
          where: {
            employee_id_company_id: {
              employee_id: id,
              company_id: companyId,
            },
          }
        });

        if (existingDocs) {
          const merge = (existing: any, incoming: any) => {
            const exArr = Array.isArray(existing) ? existing : [];
            const inArr = Array.isArray(incoming) ? incoming : [];
            // Keep all existing, add new ones that are not duplicates
            const set = new Set([...exArr, ...inArr]);
            return Array.from(set);
          };

          Object.keys(payload).forEach(key => {
            payload[key] = merge((existingDocs as any)[key], payload[key]);
          });
        }
      }

      await prisma.employeeDocument.upsert({
        where: {
          employee_id_company_id: {
            employee_id: id,
            company_id: companyId,
          },
        },
        update: payload,
        create: {
          employee_id: id,
          company_id: companyId,
          ...payload
        },
      });
    }

    // Invalidate Cache
    if (documents) {
      redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
      redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
      redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
      redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
      redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
      redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
      redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);
    }

    res.status(200).json({ status: "success", message: "Documents updated" });
  } catch (error) {
    next(error);
  }
};


