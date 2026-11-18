import { z } from 'zod';
import { ClientPhases, ContractTypes, CustomerStatuses, ServiceModels } from '../types/request';

function tuple<T extends readonly string[]>(values: T) {
  return values as unknown as [string, ...string[]];
}

const localPathSchema = z
  .string()
  .trim()
  .min(1, { message: 'Local path is required' })
  .max(500)
  .refine((value) => /^(?:[A-Za-z]:\\|\\\\)/.test(value), {
    message: 'Local path must be a Windows path (C:\\... or \\\\server\\...)',
  });

/**
 * Directory synced from SharePoint/OneDrive on the user's machine. Only the
 * local path is stored; the backend never opens or lists it.
 */
export const directoryLinkSchema = z.object({
  localPath: localPathSchema,
});

const optionalText = (max = 200) => z.string().trim().max(max).nullable().optional();
const optionalEnum = <T extends readonly string[]>(values: T) =>
  z.enum(tuple(values)).nullable().optional();

export const updateClientSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  clientType: z.enum(['Cloud', 'Rent', 'PS']).optional(),
  country: optionalText(100),
  contact: optionalText(300),
  customerStatus: optionalEnum(CustomerStatuses),
  currentPhase: optionalEnum(ClientPhases),
  contractSigned: z.boolean().optional(),
  contractType: optionalEnum(ContractTypes),
  serviceModel: optionalEnum(ServiceModels),
  businessUnit: optionalText(200),
  tags: z.array(z.string().trim().max(100)).max(100).optional(),
  salesOwnerId: optionalText(200),
  clientOwnerId: optionalText(200),
  infosecOwnerId: optionalText(200),
  infosecRepoUrl: optionalText(2000),
});

export type DirectoryLinkInput = z.infer<typeof directoryLinkSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
