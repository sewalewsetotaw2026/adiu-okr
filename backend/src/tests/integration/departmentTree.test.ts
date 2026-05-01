
import request from "supertest";
import app, { prisma } from "../../app";
import { generateToken } from "../../utils/auth";


describe("GET /api/v1/departments/tree", () => {
  let token: string;
  let companyId: number;

  beforeAll(async () => {
    // Setup test data
    const company = await prisma.company.create({
      data: {
        company_code: "TREE_TEST",
        name: "Tree Test Corp",
      },
    });
    companyId = company.id;

    // Create dept
    const dept = await prisma.department.create({
      data: { company_id: companyId, name: "Engineering" },
    });

    // Create job titles
    const jobTitleManager = await prisma.jobTitle.create({
        data: { company_id: companyId, title: "Manager" }
    });
    const jobTitleDev = await prisma.jobTitle.create({
        data: { company_id: companyId, title: "Dev" }
    });

    // Create Manager
    const manager = await prisma.employee.create({
      data: {
        id: "MGR001",
        company_id: companyId,
        full_name: "Boss Man",
        // email removed
      }
    });
    // Link to AppUser for login/token if needed, but we might just mock req.user
    
    // Create Employment for Manager
    await prisma.employment.create({
      data: {
        employee_id: manager.id,
        company_id: companyId,
        department_id: dept.id,
        job_title_id: jobTitleManager.id,
        employment_type: "Full Time",
        start_date: new Date(),
        is_active: true
      }
    });

    // Create Employee reporting to Manager
    const employee = await prisma.employee.create({
        data: {
            id: "EMP001",
            company_id: companyId,
            full_name: "Dev Guy"
        }
    });

    await prisma.employment.create({
        data: {
            employee_id: employee.id,
            company_id: companyId,
            department_id: dept.id,
            job_title_id: jobTitleDev.id,
            manager_id: manager.id, // THE LINK
            employment_type: "Full Time",
            start_date: new Date(),
            is_active: true
        }
    });

    // Create AppRole
    const role = await prisma.appRole.create({
      data: {
        company_id: companyId,
        name: "Manager",
        description: "Manager Role"
      }
    });

    // Mock token generation or setup
    // We'll rely on a known user ID (manager's ID linked to a user)
    // For integration test complexity, we might mock the auth middleware or create a full AppUser.
    // Let's create an AppUser.
    const user = await prisma.appUser.create({
        data: {
            // username: "boss_user", // Removed
            password_hash: "hashedpassword",
            email: "boss@test.com",
            company_id: companyId,
            employee_id: manager.id,
            role_id: role.id
        }
    });

    token = generateToken(String(user.id), String(companyId), String(role.id));
  });

  afterAll(async () => {
    // Cleanup
    await prisma.employment.deleteMany({ where: { company_id: companyId }});
    await prisma.employee.deleteMany({ where: { company_id: companyId }});
    await prisma.department.deleteMany({ where: { company_id: companyId }});
    await prisma.jobTitle.deleteMany({ where: { company_id: companyId }});
    await prisma.appUser.deleteMany({ where: { company_id: companyId }});
    await prisma.appRole.deleteMany({ where: { company_id: companyId }});
    await prisma.company.delete({ where: { id: companyId }});
  });

  test("It should return a flat list of employees with manager_ids", async () => {
    const res = await request(app)
      .get("/api/v1/departments/tree")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.employees).toHaveLength(2);
    
    const emp = res.body.data.employees.find((e: any) => e.id === "EMP001");
    expect(emp).toBeDefined();
    expect(emp.manager_id).toBe("MGR001");
    expect(emp.department_name).toBe("Engineering");
  });
});
