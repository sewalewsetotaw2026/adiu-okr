import request from "supertest";
import app from "src/app";
import { cleanupTestEmployees, testPrisma } from "src/tests/setup";
import { createTestUser, Roles } from "src/tests/utils/testHelpers";

describe("E2E: OKR Validation Guards", () => {
  let companyId: number;
  let adminToken: string;

  const authedGet = (url: string) =>
    request(app).get(url).set("Authorization", `Bearer ${adminToken}`);
  const authedPost = (url: string, body?: any) =>
    request(app)
      .post(url)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(body);
  const authedPatch = (url: string, body?: any) =>
    request(app)
      .patch(url)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(body);

  beforeAll(async () => {
    const company = await testPrisma.company.findFirst({
      where: { company_code: "TEST01" },
    });
    if (!company) {
      throw new Error("Test company not found.");
    }
    companyId = company.id;

    const stamp = Date.now().toString().slice(-7);
    const admin = await createTestUser(
      companyId,
      `TEST-OKR-ADM-${stamp}`,
      `okr-admin-${stamp}@test.com`,
      Roles.ADMIN,
    );
    adminToken = admin.token;
  });

  afterAll(async () => {
    await cleanupTestEmployees(companyId);
  });

  describe("Route param ID guards", () => {
    it("rejects non-numeric company objective id", async () => {
      const response = await authedGet("/api/v1/okr/company/objectives/abc");
      expect(response.status).toBe(400);
    });

    it("rejects non-numeric department objective id", async () => {
      const response = await authedGet("/api/v1/okr/department/objectives/abc");
      expect(response.status).toBe(400);
    });

    it("rejects non-numeric employee objective id", async () => {
      const response = await authedGet("/api/v1/okr/employee/objectives/abc");
      expect(response.status).toBe(400);
    });

    it("rejects invalid contributor id on flag update", async () => {
      const response = await authedPatch("/api/v1/okr/contributors/abc/flag", {
        is_required_for_completion: true,
      });
      expect(response.status).toBe(400);
    });

    it("rejects non-numeric cycle id", async () => {
      const response = await authedGet("/api/v1/okr/cycles/abc");
      expect(response.status).toBe(400);
    });

    it("rejects non-numeric dashboard completion id", async () => {
      const response = await authedGet(
        "/api/v1/okr/dashboard/completion/abc?level=COMPANY",
      );
      expect(response.status).toBe(400);
    });

    it("rejects non-numeric archive id", async () => {
      const response = await authedGet("/api/v1/okr/archives/abc");
      expect(response.status).toBe(400);
    });

    it("rejects non-numeric audit snapshot id", async () => {
      const response = await authedGet("/api/v1/okr/audit/snapshots/abc");
      expect(response.status).toBe(400);
    });
  });

  describe("Controller validation guards", () => {
    it("rejects unsupported execution_mode for department objective creation", async () => {
      const response = await authedPost("/api/v1/okr/department/objectives", {
        department_id: 1,
        company_kr_id: 1,
        execution_mode: "INVALID_MODE",
        title: "Invalid mode objective",
      });

      expect(response.status).toBe(400);
      expect(String(response.body?.message || "")).toMatch(/execution_mode/i);
    });

    it("rejects non-numeric IDs for department KR adoption", async () => {
      const response = await authedPost("/api/v1/okr/department/adopt-kr", {
        department_id: "abc",
        company_kr_id: 1,
      });

      expect(response.status).toBe(400);
    });

    it("rejects non-numeric metric_definition_id when creating department KR", async () => {
      const response = await authedPost(
        "/api/v1/okr/department/objectives/1/key-results",
        {
          title: "Department KR invalid metric",
          metric_definition_id: "not-a-number",
        },
      );

      expect(response.status).toBe(400);
      expect(String(response.body?.message || "")).toMatch(
        /metric_definition_id/i,
      );
    });

    it("rejects non-numeric weight_percent when creating department KR", async () => {
      const response = await authedPost(
        "/api/v1/okr/department/objectives/1/key-results",
        {
          title: "Department KR invalid weight",
          metric_definition_id: 1,
          weight_percent: "bad-value",
        },
      );

      expect(response.status).toBe(400);
      expect(String(response.body?.message || "")).toMatch(/weight_percent/i);
    });

    it("rejects invalid contributor role_type", async () => {
      const response = await authedPost("/api/v1/okr/contributors", {
        department_kr_id: 1,
        user_id: "TEST-USER",
        role_type: "UNKNOWN_ROLE",
      });

      expect(response.status).toBe(400);
      expect(String(response.body?.message || "")).toMatch(/role_type/i);
    });

    it("rejects non-boolean is_required_for_completion for contributor assignment", async () => {
      const response = await authedPost("/api/v1/okr/contributors", {
        department_kr_id: 1,
        user_id: "TEST-USER",
        role_type: "EMPLOYEE",
        is_required_for_completion: "yes",
      });

      expect(response.status).toBe(400);
      expect(String(response.body?.message || "")).toMatch(
        /is_required_for_completion/i,
      );
    });

    it("rejects invalid department_ids payload for assigning departments", async () => {
      const response = await authedPost(
        "/api/v1/okr/company/key-results/1/assign-departments",
        {
          department_ids: [1, "x"],
        },
      );

      expect(response.status).toBe(400);
      expect(String(response.body?.message || "")).toMatch(/department_ids/i);
    });

    it("rejects empty department_ids payload for assigning departments", async () => {
      const response = await authedPost(
        "/api/v1/okr/company/key-results/1/assign-departments",
        {
          department_ids: [],
        },
      );

      expect(response.status).toBe(400);
      expect(String(response.body?.message || "")).toMatch(/department_ids/i);
    });

    it("rejects company KR department assignment with non-positive route id", async () => {
      const response = await authedPost(
        "/api/v1/okr/company/key-results/0/assign-departments",
        {
          department_ids: [1],
        },
      );

      expect(response.status).toBe(400);
    });

    it("rejects partial inline contributor payload on department KR creation", async () => {
      const response = await authedPost(
        "/api/v1/okr/department/objectives/1/key-results",
        {
          title: "Department KR partial contributor",
          metric_definition_id: 1,
          contributor_user_id: "TEST-EMP-1",
        },
      );

      expect(response.status).toBe(400);
      expect(String(response.body?.message || "")).toMatch(/contributor/i);
    });

    it("rejects is_required_for_completion without inline contributor", async () => {
      const response = await authedPost(
        "/api/v1/okr/department/objectives/1/key-results",
        {
          title: "Department KR invalid completion flag",
          metric_definition_id: 1,
          is_required_for_completion: true,
        },
      );

      expect(response.status).toBe(400);
      expect(String(response.body?.message || "")).toMatch(
        /is_required_for_completion/i,
      );
    });
  });
});
