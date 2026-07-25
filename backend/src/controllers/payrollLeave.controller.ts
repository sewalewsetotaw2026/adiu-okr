import { Request, Response } from 'express';
import { getPaidLeaveDaysPerEmployee } from 'src/payrollLeaveData.service';

export const getPaidLeave = async (req: Request, res: Response) => {
  const { companyId, startDate, endDate } = req.query;

  if (!companyId || !startDate || !endDate) {
    return res.status(400).json({
      error: 'companyId, startDate and endDate are required',
    });
  }

  try {
    const leaveMap = await getPaidLeaveDaysPerEmployee(
      parseInt(companyId as string),
      startDate as string,
      endDate as string,
    );

    // Convert Map to a plain array for JSON response
    const data = Array.from(leaveMap.entries()).map(([employeeId, paidLeaveDays]) => ({
      employeeId,
      paidLeaveDays,
    }));

    return res.status(200).json({ count: data.length, data });
  } catch (err: any) {
    console.error('[LeaveController] Failed to fetch paid leave data:', err.message);
    return res.status(500).json({ error: err.message });
  }
};