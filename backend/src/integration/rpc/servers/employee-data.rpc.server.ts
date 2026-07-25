import type { ConsumeMessage } from "amqplib";
import {
  QueueNames,
  RABBITMQ_DEFAULTS,
  type EmployeeDataRequest,
  type EmployeeDataResponse,
  type EmployeeSyncRecord,
} from "solarios";
import { getRabbitMQChannel } from "../../rabbitmq/rabbitmq.adapter";
import { sendToQueue } from "../../rabbitmq/rabbitmq.service";
import { prisma } from "src/app";
import logger from "src/config/logger";

/**
 * Extended employee record with additional fields from EDM's employment
 * and appUser tables that the base solarios EmployeeSyncRecord doesn't include.
 */
interface ExtendedEmployeeSyncRecord {
  probationEndDate: string | null;
  employmentEndDate: string | null;
  contractReference: string | null;
  costSharingBalance: number | null;
}

type FullEmployeeSyncRecord = EmployeeSyncRecord & ExtendedEmployeeSyncRecord;

/**
 * EDM's RPC server — serves employee data to Payroll on demand.
 *
 * Payroll calls this:
 *  - Before every payroll run (full sync for a company)
 *  - On demand sync triggered by HR admin
 *
 * Returns a flat EmployeeSyncRecord[] — Payroll stores these
 * locally and never needs to call EDM during payroll calculation.
 *
 * prefetch(1): joins multiple tables for potentially hundreds
 * of employees — one request at a time prevents DB overload.
 */
export async function startEmployeeDataRpcServer(): Promise<void> {
  const channel = getRabbitMQChannel();

  await channel.assertQueue(QueueNames.rpc.employeeData.request, {
    ...RABBITMQ_DEFAULTS.QUEUE_OPTIONS,
  });

  await channel.prefetch(1);

  channel.consume(
    QueueNames.rpc.employeeData.request,
    async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      const { replyTo, correlationId } = msg.properties;

      if (!replyTo || !correlationId) {
        logger.warn("[EDM:EmployeeRPC] Missing replyTo or correlationId — discarding");
        channel.nack(msg, false, false);
        return;
      }

      let response: EmployeeDataResponse;

      try {
        const request = JSON.parse(
          msg.content.toString()
        ) as EmployeeDataRequest;

        logger.debug(
          "[EDM:EmployeeRPC] Request received",
          { companyId: request.companyId, correlationId }
        );

        // companyId comes from Payroll as string — EDM stores it as Int
        const companyIdInt = parseInt(request.companyId, 10);

        const whereClause: any = {
          company_id: companyIdInt,
        };

        // If specific employee IDs requested, filter by them
        if (request.employeeIds && request.employeeIds.length > 0) {
          whereClause.id = { in: request.employeeIds };
        }

        const employees = await prisma.employee.findMany({
          where: whereClause,
          select: {
            id:               true,
            full_name:        true,
            gender:           true,
            date_of_birth:    true,
            tin_number:       true,
            pension_number:   true,
            place_of_work:    true,
            company_id:       true,

            // Employment details — latest employment record
            employments: {
              orderBy: { start_date: "desc" },
              take:    1,
              select: {
                jobTitle:             { select: { title: true } },
                department:           { select: { name: true } },
                employment_type:      true,
                start_date:           true,
                end_date:             true,
                basic_salary:         true,
                gross_salary:         true,
                probation_end_date:   true,
                contract_reference:   true,
                cost_sharing_amount:  true,

                // Active allowances via employment
                allowances: {
                  where:  { is_active: true },
                  select: {
                    allowanceType: { select: { name: true } },
                    amount:        true,
                  },
                },
              },
            },

            // Financial details — latest bank account
            financialDetails: {
              take:    1,
              select: {
                bank:           { select: { name: true } },
                account_number: true,
              },
            },

            // App user email
            appUsers: {
              take:    1,
              select: { email: true },
            },
          },
        });

        // Map EDM snake_case → shared EmployeeSyncRecord camelCase
        const mapped: FullEmployeeSyncRecord[] = employees.map((e: any) => {
          const employment    = e.employments?.[0];
          const financial     = e.financialDetails?.[0];
          const appUser       = e.appUsers?.[0];
          const nameParts     = (e.full_name ?? "").split(" ");
          const firstName     = nameParts[0] ?? "";
          const lastName      = nameParts.slice(1).join(" ") || "";

          return {
            externalId:        e.id,
            companyId:         String(e.company_id),
            firstName,
            lastName,
            email:             appUser?.email ?? null,
            tinNumber:         e.tin_number   ?? null,
            pensionNumber:     e.pension_number ?? null,
            gender:            e.gender        ?? null,
            dateOfBirth:       e.date_of_birth?.toISOString() ?? null,
            placeOfWork:       e.place_of_work ?? null,

            jobPosition:       employment?.jobTitle?.title    ?? null,
            departmentName:    employment?.department?.name    ?? null,
            employmentType:    employment?.employment_type     ?? null,
            hireDate:          employment?.start_date?.toISOString() ?? null,
            managerName:       null,

            basicSalary:       employment?.basic_salary
                                 ? Number(employment.basic_salary)
                                 : null,
            grossSalary:       employment?.gross_salary
                                 ? Number(employment.gross_salary)
                                 : null,
            bankName:          financial?.bank?.name           ?? null,
            accountNumber:     financial?.account_number       ?? null,
            currency:          "ETB",

            isPensionEligible: true,
            isTaxExempt:       false,
            isActive:          true,

            allowances: (employment?.allowances ?? []).map((a: any) => ({
              allowanceType: a.allowanceType?.name ?? "UNKNOWN",
              amount:        Number(a.amount),
            })),

            // Extended fields not in base EmployeeSyncRecord
            probationEndDate:  employment?.probation_end_date?.toISOString() ?? null,
            employmentEndDate: employment?.end_date?.toISOString() ?? null,
            contractReference: employment?.contract_reference ?? null,
            costSharingBalance: employment?.cost_sharing_amount
                                 ? Number(employment.cost_sharing_amount)
                                 : null,
          };
        });

        response = {
          companyId: request.companyId,
          employees: mapped,
          total:     mapped.length,
        };

        logger.info(
          "[EDM:EmployeeRPC] Responding",
          { count: mapped.length, correlationId }
        );

      } catch (err) {
        logger.error("[EDM:EmployeeRPC] Failed to fetch employees", err);
        response = { companyId: "", employees: [], total: 0 };
      }

      sendToQueue(replyTo, response, { correlationId });
      channel.ack(msg);

      logger.debug(
        "[EDM:EmployeeRPC] Reply sent",
        { replyTo, correlationId }
      );
    },
    { noAck: false }
  );

  logger.info(
    `[EDM] Employee data RPC server listening → ${QueueNames.rpc.employeeData.request}`
  );
}