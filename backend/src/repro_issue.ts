
import { calculateAccruedBalance, getAnniversaryYearStartDate } from './utils/leaveUtils';

const joinDate = new Date('2024-06-01T00:00:00.000Z');
const today = new Date('2026-01-30T10:00:00.000Z');

console.log('--- Inputs ---');
console.log('Join Date:', joinDate.toISOString());
console.log('Today:', today.toISOString());
console.log('Basis:', 'ANNIVERSARY');

console.log('\n--- Debugging getAnniversaryYearStartDate ---');
const annivStart = getAnniversaryYearStartDate(joinDate, today);
console.log('Anniversary Start Date:', annivStart.toISOString());

console.log('\n--- Calculating Accrued Balance ---');
const result = calculateAccruedBalance(
    joinDate,
    today,
    16, // baseDays
    365, // divisor
    1, // fiscalStartMonth (irrelevant for Anniversary)
    2, // incrementPeriod
    1, // incrementAmount
    null, // maxCap
    "ANNIVERSARY"
);

console.log('Result:', JSON.stringify(result, null, 2));

console.log('Days in Fiscal Year (Manual):', (today.getTime() - annivStart.getTime()) / (1000 * 60 * 60 * 24));
