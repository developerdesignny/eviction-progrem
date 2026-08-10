-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('NP', 'HOLDOVER');

-- CreateEnum
CREATE TYPE "CloseReason" AS ENUM ('BALANCE_PAID_IN_FULL', 'TENANT_VACATED', 'CASE_DISMISSED', 'SETTLED_OUTSIDE_COURT', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactRole" AS ENUM ('TENANT', 'OCCUPANT');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'DATE', 'CHECKBOX', 'CURRENCY', 'SELECT', 'FILE');

-- CreateEnum
CREATE TYPE "EntryPoint" AS ENUM ('FRONT', 'BACK', 'SIDE', 'RIGHT', 'LEFT');

-- CreateEnum
CREATE TYPE "StatusEvent" AS ENUM ('CLOSED', 'REOPENED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseCounter" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CaseCounter_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectContact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" "ContactRole" NOT NULL,

    CONSTRAINT "ProjectContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "docketNumber" TEXT,
    "type" "ProjectType" NOT NULL,
    "landlordContactId" TEXT,
    "tenancyStartDate" TIMESTAMP(3),
    "lengthOfTenancy" TEXT,
    "monthlyRentAmount" DECIMAL(12,2),
    "totalRentBalanceOwed" DECIMAL(12,2),
    "leaseAgreementFileId" TEXT,
    "ledgerAttached" BOOLEAN NOT NULL DEFAULT false,
    "propertyStreetAddress" TEXT,
    "apartmentUnitNumber" TEXT,
    "floorNumber" TEXT,
    "propertyCity" TEXT,
    "propertyState" TEXT,
    "propertyZip" TEXT,
    "propMgmtAgreementFileId" TEXT,
    "propertyAccessStraightforward" BOOLEAN NOT NULL DEFAULT false,
    "additionalAccessInstructions" TEXT,
    "activeRentalPermit" BOOLEAN NOT NULL DEFAULT false,
    "submittedByName" TEXT,
    "submittedByTitle" TEXT,
    "submittedByCompany" TEXT,
    "submittedByPhone" TEXT,
    "submittedByEmail" TEXT,
    "submittedByDate" TIMESTAMP(3),
    "markedPersonalConfidential" BOOLEAN NOT NULL DEFAULT false,
    "entryPoint" "EntryPoint",
    "intakeDone" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closeReason" "CloseReason",
    "closeReasonDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageDefinition" (
    "id" TEXT NOT NULL,
    "projectType" "ProjectType" NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StageDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldDefinition" (
    "id" TEXT NOT NULL,
    "stageDefinitionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageDefinitionId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldValue" (
    "id" TEXT NOT NULL,
    "projectStageId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "textValue" TEXT,
    "dateValue" TIMESTAMP(3),
    "boolValue" BOOLEAN,
    "numericValue" DECIMAL(12,2),
    "fileId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStatusEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "event" "StatusEvent" NOT NULL,
    "reason" "CloseReason",
    "reasonDetail" TEXT,
    "userId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAttachment" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Contact_name_idx" ON "Contact"("name");

-- CreateIndex
CREATE INDEX "ProjectContact_contactId_idx" ON "ProjectContact"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectContact_projectId_contactId_role_key" ON "ProjectContact"("projectId", "contactId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Project_caseNumber_key" ON "Project"("caseNumber");

-- CreateIndex
CREATE INDEX "Project_closedAt_idx" ON "Project"("closedAt");

-- CreateIndex
CREATE INDEX "Project_type_idx" ON "Project"("type");

-- CreateIndex
CREATE INDEX "StageDefinition_projectType_sortOrder_idx" ON "StageDefinition"("projectType", "sortOrder");

-- CreateIndex
CREATE INDEX "FieldDefinition_stageDefinitionId_sortOrder_idx" ON "FieldDefinition"("stageDefinitionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStage_projectId_stageDefinitionId_key" ON "ProjectStage"("projectId", "stageDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldValue_projectStageId_fieldDefinitionId_key" ON "FieldValue"("projectStageId", "fieldDefinitionId");

-- CreateIndex
CREATE INDEX "ProjectStatusEvent_projectId_at_idx" ON "ProjectStatusEvent"("projectId", "at");

-- AddForeignKey
ALTER TABLE "ProjectContact" ADD CONSTRAINT "ProjectContact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContact" ADD CONSTRAINT "ProjectContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_landlordContactId_fkey" FOREIGN KEY ("landlordContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_leaseAgreementFileId_fkey" FOREIGN KEY ("leaseAgreementFileId") REFERENCES "FileAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_propMgmtAgreementFileId_fkey" FOREIGN KEY ("propMgmtAgreementFileId") REFERENCES "FileAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDefinition" ADD CONSTRAINT "FieldDefinition_stageDefinitionId_fkey" FOREIGN KEY ("stageDefinitionId") REFERENCES "StageDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStage" ADD CONSTRAINT "ProjectStage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStage" ADD CONSTRAINT "ProjectStage_stageDefinitionId_fkey" FOREIGN KEY ("stageDefinitionId") REFERENCES "StageDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldValue" ADD CONSTRAINT "FieldValue_projectStageId_fkey" FOREIGN KEY ("projectStageId") REFERENCES "ProjectStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldValue" ADD CONSTRAINT "FieldValue_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "FieldDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldValue" ADD CONSTRAINT "FieldValue_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatusEvent" ADD CONSTRAINT "ProjectStatusEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
