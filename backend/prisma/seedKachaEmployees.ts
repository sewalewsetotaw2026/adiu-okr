import { PrismaClient, OnboardingStatus, ProgramType, InstitutionCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// Robust date parsing to avoid 1-day lag
function parseKachaDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || dateStr === "NA" || dateStr === "" || dateStr === "#VALUE!") return null;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;

    // To avoid timezone shifts, we set the date to NOON local time.
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  } catch (e) {
    return null;
  }
}

// Name matching helper with aliases
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

const nameAliases: { [key: string]: string } = {
  "zemcheal fsaha": "zemicheal fsaha werkneh",
  "zemchael fsaha": "zemicheal fsaha werkneh",
  "lidya gabo": "lydia gabo sheko",
  "fozia redi": "foziya redi chali",
  "henok ayele iticha": "henok ayele", // Just in case
  "addis tsega aragie": "addis tsega aragie", // Check if exists
};

async function main() {
  console.log("Starting Kacha employee seeding (Enhanced Full Sync)...");

  const kachaCompany = await prisma.company.upsert({
    where: { company_code: "KACHA" },
    update: { name: "Kacha Digital Financial Service S.C." },
    create: {
      company_code: "KACHA",
      name: "Kacha Digital Financial Service S.C.",
      is_active: true,
    },
  });

  const companyId = kachaCompany.id;
  
  const employeeRole = await prisma.appRole.upsert({
    where: { company_id_name: { company_id: companyId, name: "Employee" } },
    update: {},
    create: { company_id: companyId, name: "Employee", description: "Default Employee role" },
  });

  // Load Base Employee Data
  const dataPath = path.join(__dirname, "../company data/employees_all.json");
  const allEmployees = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  console.log(`Processing ${allEmployees.length} base employee records...`);
  let empCounter = 1;

  for (const data of allEmployees) {
    const employeeId = `KACHA-EMP-${String(empCounter++).padStart(3, "0")}`;
    
    // a. Dept & Job Title
    const dept = await prisma.department.upsert({
      where: { company_id_name: { company_id: companyId, name: data.department || "General" } },
      update: {},
      create: {
        company_id: companyId,
        name: data.department || "General",
        department_code: (data.department || "GEN").toUpperCase().replace(/\s+/g, "_").slice(0, 10),
      },
    });

    const jobTitle = await prisma.jobTitle.upsert({
      where: { company_id_title_level: { company_id: companyId, title: data.job_title || "Staff", level: "Mid" } },
      update: {},
      create: { company_id: companyId, title: data.job_title || "Staff", level: "Mid" },
    });

    const dob = parseKachaDate(data.dob);

    const employee = await prisma.employee.upsert({
      where: { id: employeeId },
      update: {
        full_name: data.full_name,
        company_id: companyId,
        gender: data.gender === "M" ? "Male" : (data.gender === "F" ? "Female" : "Other"),
        date_of_birth: dob,
        tin_number: data.tin_number && data.tin_number !== "NA" ? data.tin_number : null,
        pension_number: data.pension_number && data.pension_number !== "NA" ? data.pension_number : null,
        place_of_work: data.place_of_work || "Head Office",
      },
      create: {
        id: employeeId,
        company_id: companyId,
        full_name: data.full_name,
        gender: data.gender === "M" ? "Male" : (data.gender === "F" ? "Female" : "Other"),
        date_of_birth: dob,
        tin_number: data.tin_number && data.tin_number !== "NA" ? data.tin_number : null,
        pension_number: data.pension_number && data.pension_number !== "NA" ? data.pension_number : null,
        place_of_work: data.place_of_work || "Head Office",
      },
    });

    // Employment
    const startDate = parseKachaDate(data.employment_date) || new Date();
    const basicSalary = data.basic_salary ? parseFloat(data.basic_salary.replace(/,/g, "")) : 0;
    const grossSalary = data.gross_salary ? parseFloat(data.gross_salary.replace(/,/g, "")) : 0;

    const existingEmployment = await prisma.employment.findFirst({
        where: { employee_id: employee.id, company_id: companyId }
    });

    let employment;
    const employmentData = {
        department_id: dept.id,
        job_title_id: jobTitle.id,
        employment_type: data.employment_type || "Full Time",
        start_date: startDate,
        basic_salary: isNaN(basicSalary) ? 0 : basicSalary,
        gross_salary: isNaN(grossSalary) ? 0 : grossSalary,
        cost_sharing_status: data.cost_sharing_status || "NA",
        cost_sharing_amount: data.cost_sharing_amount ? parseFloat(data.cost_sharing_amount.replace(/,/g, "")) || 0 : 0,
        is_active: true,
    };

    if (existingEmployment) {
        employment = await prisma.employment.update({
            where: { id: existingEmployment.id },
            data: employmentData
        });
    } else {
        employment = await prisma.employment.create({
            data: { ...employmentData, employee_id: employee.id, company_id: companyId }
        });
    }

    // Allowances
    if (data.employment_type === "Full Time") {
        await prisma.employeeAllowance.deleteMany({ where: { employment_id: employment.id } });
        const allowanceMappings = [
            { name: "Representation Allowance", key: "representation_allowance" },
            { name: "Meal Allowance", key: "meal_allowance" },
            { name: "Housing Allowance", key: "housing_allowance" },
            { name: "Transportation", key: "transportation" },
            { name: "Project Allowance", key: "project_allowance" },
        ];
        for (const mapping of allowanceMappings) {
            const val = data[mapping.key];
            if (val && typeof val === 'string' && val.trim() !== "" && val !== "NA") {
                const amount = parseFloat(val.replace(/,/g, ""));
                if (!isNaN(amount) && amount > 0) {
                    const type = await prisma.allowanceType.findUnique({ where: { name: mapping.name } });
                    if (type) {
                        await prisma.employeeAllowance.create({
                            data: { employment_id: employment.id, allowance_type_id: type.id, amount, effective_date: startDate }
                        });
                    }
                }
            }
        }
    }

    // User Account
    const email = data.full_name.toLowerCase().replace(/\s+/g, ".") + "@kacha.com";
    const PasswordHash = await bcrypt.hash("password123", 12);
    await prisma.appUser.upsert({
        where: { email },
        update: { is_active: true, employee_id: employee.id, company_id: companyId },
        create: {
            company_id: companyId,
            employee_id: employee.id,
            email,
            password_hash: PasswordHash, 
            role_id: employeeRole.id,
            is_active: true,
            onboarding_status: OnboardingStatus.COMPLETED,
        }
    });

    // Extra Info
    if (data.phone_number) {
        const phones = String(data.phone_number).split(/[\/'\s,]+/).filter((p: string) => p.length >= 10);
        await prisma.employeePhone.deleteMany({ where: { employee_id: employee.id } });
        for (const p of phones) {
            await prisma.employeePhone.create({
                data: { employee_id: employee.id, company_id: companyId, phone_number: p, phone_type: "Mobile", is_primary: phones.indexOf(p) === 0 }
            }).catch(() => {});
        }
    }
    if (data.experience_before && data.experience_before !== "NA" && data.experience_before !== "") {
        await prisma.employmentHistory.deleteMany({ where: { employee_id: employee.id } });
        await prisma.employmentHistory.create({
            data: { employee_id: employee.id, previous_company_name: "Various Previous Employers", notes: data.experience_before, start_date: new Date(1900, 0, 1, 12, 0, 0), is_verified: true }
        });
    }
    if (data.educational_status && data.educational_status !== "NA" && data.educational_status !== "") {
        await prisma.employeeEducation.deleteMany({ where: { employee_id: employee.id } });
        let levelName = "Bachelor's Degree";
        if (data.educational_status.toLowerCase().includes("masters")) levelName = "Master's Degree";
        if (data.educational_status.toLowerCase().includes("diploma")) levelName = "Diploma";
        const eduLevel = await prisma.educationLevel.upsert({ where: { name: levelName }, update: {}, create: { name: levelName } });
        let fieldName = "Business";
        if (data.educational_status.toLowerCase().includes("accounting")) fieldName = "Accounting";
        if (data.educational_status.toLowerCase().includes("engineering")) fieldName = "Engineering";
        if (data.educational_status.toLowerCase().includes("computer") || data.educational_status.toLowerCase().includes("software")) fieldName = "Computer Science/IT";
        const field = await prisma.fieldOfStudy.upsert({ where: { name: fieldName }, update: {}, create: { name: fieldName } });
        const instName = data.graduating_institute || "Unknown Institution";
        const cat = data.university === "P" ? InstitutionCategory.Private : InstitutionCategory.Government;
        const institution = await prisma.institution.upsert({ where: { name: instName }, update: { category: cat }, create: { name: instName, category: cat } });
        await prisma.employeeEducation.create({ data: { employee_id: employee.id, education_level_id: eduLevel.id, field_of_study_id: field.id, institution_id: institution.id, program_type: ProgramType.Regular, start_date: new Date(1950, 0, 1, 12, 0, 0), is_verified: true } });
    }
  }

  // Seeding Career Events
  console.log("Seeding Career Events from promotions.json...");
  const promoPath = path.join(__dirname, "../company data/promotions.json");
  if (fs.existsSync(promoPath)) {
    const promotions = JSON.parse(fs.readFileSync(promoPath, "utf8"));
    const internalEmployees = await prisma.employee.findMany({ where: { company_id: companyId } });

    // Clear old career events to avoid duplicates on re-run
    await prisma.employeeCareerEvent.deleteMany({
        where: { employee_id: { in: internalEmployees.map(e => e.id) } }
    });

    for (const promo of promotions) {
        let promoName = normalizeName(promo.full_name || "");
        if (nameAliases[promoName]) promoName = nameAliases[promoName];

        let emp = internalEmployees.find(e => normalizeName(e.full_name) === promoName);
        if (!emp) {
            // Fuzzy match (starts with or includes)
            emp = internalEmployees.find(e => {
                const en = normalizeName(e.full_name);
                return en.includes(promoName) || promoName.includes(en);
            });
        }

        if (emp) {
            const eventDate = parseKachaDate(promo.date) || new Date();
            const prevSalary = parseFloat(promo.previous_salary) || 0;
            const newSalary = parseFloat(promo.current_salary) || 0;

            let prevJobTitleId = null;
            if (promo.previous_position && promo.previous_position !== "") {
                const jt = await prisma.jobTitle.upsert({ where: { company_id_title_level: { company_id: companyId, title: promo.previous_position, level: "Mid" } }, update: {}, create: { company_id: companyId, title: promo.previous_position, level: "Mid" } });
                prevJobTitleId = jt.id;
            }
            let newJobTitleId = null;
            if (promo.current_position && promo.current_position !== "") {
                const jt = await prisma.jobTitle.upsert({ where: { company_id_title_level: { company_id: companyId, title: promo.current_position, level: "Mid" } }, update: {}, create: { company_id: companyId, title: promo.current_position, level: "Mid" } });
                newJobTitleId = jt.id;
            }

            await prisma.employeeCareerEvent.create({
                data: {
                    employee_id: emp.id,
                    event_date: eventDate,
                    effective_date: eventDate,
                    event_type: promo.type,
                    previous_job_title_id: prevJobTitleId,
                    new_job_title_id: newJobTitleId,
                    previous_salary: prevSalary,
                    new_salary: newSalary,
                    justification: `Imported from ${promo.type} records.`,
                    department_changed: (promo.previous_position !== promo.current_position && promo.current_position !== "")
                }
            });
        } else {
            console.log(`Warning: Could not match employee name "${promo.full_name}" for promotion seeding.`);
        }
    }
  }

  console.log("Kacha employee and promotion seeding finished successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
