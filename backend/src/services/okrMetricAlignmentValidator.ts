import { prisma } from "src/app";


export async function validateMetricAlignment(
  companyId: number,
  parentMetricId?: number | null,
  childMetricId?: number | null,
  contributesToValue: boolean = true,
  isDirect: boolean = true
) {
  if (!contributesToValue || !isDirect) {
    return { valid: true };
  }

  if (!parentMetricId || !childMetricId) {
    return { valid: true };
  }

  const parentDef = await prisma.okrMetricDefinition.findUnique({ where: { id: parentMetricId } });
  const childDef = await prisma.okrMetricDefinition.findUnique({ where: { id: childMetricId } });

  if (!parentDef || !childDef) {
    throw new Error("Metric definition lookup failed.");
  }


  const isCompatible = parentDef.category === childDef.category;

  if (!isCompatible) {
    throw new Error(`Metric category mismatch. Cannot roll up child category '${childDef.category}' directly into parent category '${parentDef.category}'.`);
  }


  return { valid: true };
}
