// backend/src/controllers/bulkUploadController.ts
import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { redisService } from "src/services/redisService";
import { uploadToCloudinary } from '../services/cloudinaryService';

interface ParsedFile {
  employeeId: string;
  docType: string;
  fileUrl: string;
  fileName: string;
  sequence?: number;
}

function parseFileName(fileName: string, fileUrl: string): ParsedFile | null {
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
  
  const sequencePrefixes = ["WE", "EC", "ED", "CERT", "CS"];
  for (const prefix of sequencePrefixes) {
    if (nameWithoutExt.startsWith(prefix)) {
      const rest = nameWithoutExt.slice(prefix.length);
      const match = rest.match(/^(\d*)(\d{4})$/);
      if (match) {
        const seqStr = match[1];
        const sequence = seqStr ? parseInt(seqStr, 10) : undefined;
        const employeeId = match[2];
        return { employeeId, docType: prefix, fileUrl, fileName, sequence };
      }
    }
  }
  
  const simplePrefixes = ["CV", "GL", "MC", "PC", "FC", "FAP", "PD", "TIN", "ES", "FAY"];
  for (const prefix of simplePrefixes) {
    if (nameWithoutExt.startsWith(prefix)) {
      const employeeId = nameWithoutExt.slice(prefix.length);
      if (employeeId.length > 0 && /^\d+$/.test(employeeId)) {
        return { employeeId, docType: prefix, fileUrl, fileName };
      }
    }
  }
  
  console.warn(`Could not parse file: ${fileName}`);
  return null;
}

export const bulkUploadFromFolder = async (req: Request, res: Response) => {
  res.status(200).json({ status: "success", message: "Not implemented (folder upload)" });
};
export const bulkUploadAllEmployeeData = async (req: Request, res: Response) => {
  res.status(200).json({ status: "success", message: "Not implemented (bulk all data)" });
};
export const bulkUploadFromFiles = async (req: Request, res: Response) => {
  res.status(200).json({ status: "success", message: "Not implemented (from files)" });
};

export const bulkUploadWithFiles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({ status: "fail", message: "Company ID not found" });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ status: "fail", message: "Please provide files" });
    }

    console.log(`Received ${files.length} files`);

    // 1. Upload to Cloudinary
    const uploadedFiles = [];
    for (const file of files) {
      try {
        const fileUrl = await uploadToCloudinary(file.buffer, file.originalname);
        uploadedFiles.push({ fileName: file.originalname, fileUrl });
        console.log(`Uploaded ${file.originalname} -> ${fileUrl}`);
      } catch (err) {
        console.error(`Failed to upload ${file.originalname}:`, err);
      }
    }
    if (uploadedFiles.length === 0) {
      return res.status(400).json({ status: "fail", message: "No files uploaded" });
    }

    // 2. Group by employee ID
    const employeeFilesMap = new Map<string, ParsedFile[]>();
    for (const file of uploadedFiles) {
      const parsed = parseFileName(file.fileName, file.fileUrl);
      if (parsed?.employeeId) {
        if (!employeeFilesMap.has(parsed.employeeId)) employeeFilesMap.set(parsed.employeeId, []);
        employeeFilesMap.get(parsed.employeeId)!.push(parsed);
      } else {
        console.warn(`Unparseable: ${file.fileName}`);
      }
    }

    const results = [];
    const errors = [];

    // 3. Process each employee group
    for (const [rawEmployeeId, parsedFiles] of employeeFilesMap) {
      const normalizedId = String(parseInt(rawEmployeeId, 10));
      console.log(`Processing employee ${normalizedId} (from ${rawEmployeeId}) with ${parsedFiles.length} files`);

      const employee = await prisma.employee.findUnique({
        where: { id_company_id: { id: normalizedId, company_id: companyId } },
      });
      if (!employee) {
        errors.push({ employeeId: rawEmployeeId, error: "Employee not found" });
        continue;
      }

      const result = await prisma.$transaction(async (tx) => {
        const documents: any = {
          cv: [], national_id: [], guarantee_letter: [], medical_certificate: [],
          police_certificate: [], certificates: [], photo: [], taxForms: [], pensionForms: [],
        };
        const educationFiles: ParsedFile[] = [];      // EC, ED
        const costSharingFiles: ParsedFile[] = [];     // CS
        const certificationFiles: ParsedFile[] = [];
        const experienceFiles: ParsedFile[] = [];

        for (const file of parsedFiles) {
          console.log(`  Processing ${file.fileName} as type ${file.docType}`);
          switch (file.docType) {
            case "CV": documents.cv.push(file.fileUrl); break;
            case "GL": documents.guarantee_letter.push(file.fileUrl); break;
            case "MC": documents.medical_certificate.push(file.fileUrl); break;
            case "FC": documents.police_certificate.push(file.fileUrl); break;
            case "PC": documents.police_certificate.push(file.fileUrl); break;
            case "FAP": documents.national_id.push(file.fileUrl); break;
            case "PD": documents.pensionForms.push(file.fileUrl); break;
            case "TIN": documents.taxForms.push(file.fileUrl); break;
            case "FAY": documents.national_id.push(file.fileUrl); break;
            case "WE": experienceFiles.push(file); break;
            case "ES": experienceFiles.push(file); break;
            case "EC": educationFiles.push(file); break;
            case "ED": educationFiles.push(file); break;
            case "CS": costSharingFiles.push(file); break;
            case "CERT": certificationFiles.push(file); break;
            default: console.warn(`Unknown docType: ${file.docType}`);
          }
        }

        // ----- Documents (non‑experience) -----
        if (Object.values(documents).some(arr => (arr as any[]).length)) {
          const existingDoc = await tx.employeeDocument.findUnique({
            where: { employee_id_company_id: { employee_id: normalizedId, company_id: companyId } },
          });
          const mergedDocs: any = {};
          const updatedKeys: string[] = [];
          for (const key of Object.keys(documents)) {
            const existingArr = existingDoc ? (existingDoc as any)[key] || [] : [];
            const newArr = documents[key];
            const combined = [...existingArr, ...newArr];
            mergedDocs[key] = [...new Set(combined)];
            if (newArr.length) updatedKeys.push(key);
          }
          await tx.employeeDocument.upsert({
            where: { employee_id_company_id: { employee_id: normalizedId, company_id: companyId } },
            update: mergedDocs,
            create: { employee_id: normalizedId, company_id: companyId, ...mergedDocs },
          });
          if (updatedKeys.length) console.log(`  Updated documents: ${updatedKeys}`);
        }

        // ----- Helper: update empty rows or create new (for simple array fields) -----
        type ModelWithDocUrls = {
          findMany: (args: any) => Promise<any[]>;
          update: (args: any) => Promise<any>;
          create: (args: any) => Promise<any>;
        };

        const updateOrCreate = async (model: ModelWithDocUrls, data: ParsedFile[], buildCreateData: (file: ParsedFile, index: number) => any) => {
          const existingRows = await model.findMany({
            where: { employee_id: normalizedId },
            orderBy: { id: 'asc' },
          });
          const emptyRows = existingRows.filter((row: any) => !row.document_urls || row.document_urls.length === 0);
          for (let i = 0; i < data.length; i++) {
            if (i < emptyRows.length) {
              await model.update({
                where: { id: emptyRows[i].id },
                data: { document_urls: [data[i].fileUrl] },
              });
              console.log(`  Updated existing record ID ${emptyRows[i].id}`);
            } else {
              await model.create({ data: buildCreateData(data[i], i) });
              console.log(`  Created new record`);
            }
          }
        };

        // ----- Employment History (WE, ES) -----
        await updateOrCreate(tx.employmentHistory, experienceFiles, (file, idx) => ({
          employee_id: normalizedId,
          previous_company_name: `${file.docType} Experience ${file.sequence || idx+1}`,
          start_date: new Date(),
          document_urls: [file.fileUrl],
        }));

        // ----- Education (EC, ED) – store URL in employee_education.document_urls -----
        const eduUpdateOrCreate = async (files: ParsedFile[]) => {
          const existingRows = await tx.employeeEducation.findMany({
            where: { employee_id: normalizedId },
            orderBy: { id: 'asc' },
          });
          const emptyRows = existingRows.filter((row: any) => !row.document_urls || row.document_urls.length === 0);
          for (let i = 0; i < files.length; i++) {
            if (i < emptyRows.length) {
              await tx.employeeEducation.update({
                where: { id: emptyRows[i].id },
                data: { document_urls: [files[i].fileUrl] },
              });
              console.log(`  Updated education record ${emptyRows[i].id} with EC URL`);
            } else {
              await tx.employeeEducation.create({
                data: {
                  employee_id: normalizedId,
                  program_type: "Regular",
                  document_urls: [files[i].fileUrl],
                },
              });
              console.log(`  Created new education record`);
            }
          }
        };
        await eduUpdateOrCreate(educationFiles);

        // ----- Cost Sharing (CS) – store in employee_cost_sharing, linked to education by sequence -----
        // Fetch all education records for this employee (ordered by id)
        const allEducations = await tx.employeeEducation.findMany({
          where: { employee_id: normalizedId },
          orderBy: { id: 'asc' },
        });
        for (let i = 0; i < costSharingFiles.length; i++) {
          const file = costSharingFiles[i];
          let targetEducation = null;
          if (file.sequence !== undefined && file.sequence > 0) {
            const idx = file.sequence - 1;
            if (idx >= 0 && idx < allEducations.length) {
              targetEducation = allEducations[idx];
            }
          } else {
            if (i < allEducations.length) targetEducation = allEducations[i];
          }

          if (targetEducation) {
            // Check if a cost sharing record already exists for this education
            const existingCostSharing = await tx.employeeCostSharing.findFirst({
              where: { education_id: targetEducation.id },
            });
            if (existingCostSharing) {
              // Append the URL to the existing document_urls array
              const newUrls = [...(existingCostSharing.document_urls || []), file.fileUrl];
              await tx.employeeCostSharing.update({
                where: { id: existingCostSharing.id },
                data: { document_urls: newUrls },
              });
              console.log(`  Updated cost sharing record for education ${targetEducation.id}`);
            } else {
              // Create a new cost sharing record linked to this education
              await tx.employeeCostSharing.create({
                data: {
                  employee_id: normalizedId,
                  education_id: targetEducation.id,
                  document_urls: [file.fileUrl],
                  currency: "ETB",
                  status: "DECLARED",
                },
              });
              console.log(`  Created cost sharing record for education ${targetEducation.id}`);
            }
          } else {
            // No matching education – create a standalone cost sharing record
            await tx.employeeCostSharing.create({
              data: {
                employee_id: normalizedId,
                document_urls: [file.fileUrl],
                currency: "ETB",
                status: "DECLARED",
              },
            });
            console.log(`  Created standalone cost sharing record (no education)`);
          }
        }

        // ----- Certifications -----
        await updateOrCreate(tx.employeeLicensesAndCertifications, certificationFiles, (file) => ({
          employee_id: normalizedId,
          name: `Certification ${file.sequence || ''}`,
          document_urls: [file.fileUrl],
        }));

        let docsCount = 0;
        for (const key of Object.keys(documents)) docsCount += documents[key].length;

        return {
          documentsProcessed: docsCount,
          educationProcessed: educationFiles.length,
          certificationsProcessed: certificationFiles.length,
          experienceProcessed: experienceFiles.length,
          costSharingProcessed: costSharingFiles.length,
        };
      });

      results.push({ employeeId: rawEmployeeId, success: true, ...result });
    }

    await redisService.delByPattern(`company:${companyId}:*`).catch(console.error);
    res.status(200).json({
      status: "success",
      message: `Processed ${results.length} employees, ${errors.length} failed`,
      data: { successful: results, failed: errors, total: employeeFilesMap.size, succeeded: results.length, failedCount: errors.length },
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    next(error);
  }
};
