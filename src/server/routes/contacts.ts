import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import { toContactDto } from '../services/projectView';

export const contactsRouter = Router();
contactsRouter.use(requireAuth);

/** Hidden contacts are excluded unless explicitly asked for — they can't be linked to anything new. */
contactsRouter.get('/', async (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const includeHidden = req.query.includeHidden === 'true';

  const contacts = await prisma.contact.findMany({
    where: {
      ...(includeHidden ? {} : { hidden: false }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ hidden: 'asc' }, { name: 'asc' }],
    take: 200,
    include: { _count: { select: { projectLinks: true, landlordProjects: true } } },
  });

  res.json(
    contacts.map((c) => ({
      ...toContactDto(c)!,
      projectCount: c._count.projectLinks + c._count.landlordProjects,
    })),
  );
});

/** One contact plus every project it touches — the "where is this used" view. */
contactsRouter.get('/:id', async (req, res) => {
  const contact = await prisma.contact.findUnique({
    where: { id: req.params.id },
    include: {
      landlordProjects: { select: { id: true, caseNumber: true, propertyStreetAddress: true } },
      projectLinks: {
        include: {
          project: { select: { id: true, caseNumber: true, propertyStreetAddress: true } },
        },
      },
    },
  });
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  res.json({
    ...toContactDto(contact)!,
    projects: [
      ...contact.landlordProjects.map((p) => ({ ...p, role: 'LANDLORD' as const })),
      ...contact.projectLinks.map((l) => ({ ...l.project, role: l.role })),
    ],
  });
});

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().nullish(),
  email: z.string().email().nullish().or(z.literal('')),
  address: z.string().nullish(),
  notes: z.string().nullish(),
});

contactsRouter.post('/', async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid contact' });
  }
  const { name, phone, email, address, notes } = parsed.data;
  const contact = await prisma.contact.create({
    data: { name, phone: phone || null, email: email || null, address: address || null, notes: notes || null },
  });
  res.status(201).json(toContactDto(contact));
});

/**
 * Editing a contact updates it everywhere it is linked — that is the point of the
 * shared table. `hidden` is the only removal there is; contacts are never deleted.
 */
contactsRouter.patch('/:id', async (req, res) => {
  const parsed = contactSchema.partial().extend({ hidden: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid contact' });
  }
  const contact = await prisma.contact.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(toContactDto(contact));
});
