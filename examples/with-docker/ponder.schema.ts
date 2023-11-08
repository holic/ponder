import { p } from "@ponder/core";

export const schema = p.createSchema({
  Account: p.createTable({
    id: p.string(),
    balance: p.bigint(),
    approvals: p.virtual("Approval.ownerId"),
    isOwner: p.boolean(),

    approvalOwnerEvents: p.virtual("ApprovalEvent.ownerId"),
    approvalSpenderEvents: p.virtual("ApprovalEvent.spenderId"),
    transferFromEvents: p.virtual("TransferEvent.fromId"),
    transferToEvents: p.virtual("TransferEvent.toId"),
  }),
  Approval: p.createTable({
    id: p.bytes(),
    amount: p.bigint(),
    ownerId: p.string().references("Account.id"),
    spender: p.string(),
  }),
  TransferEvent: p.createTable({
    id: p.string(),
    amount: p.bigint(),
    fromId: p.string().references("Account.id"),
    toId: p.string().references("Account.id"),
    timestamp: p.int(),
  }),
  ApprovalEvent: p.createTable({
    id: p.string(),
    amount: p.bigint(),
    ownerId: p.string().references("Account.id"),
    spenderId: p.string().references("Account.id"),
    timestamp: p.int(),
  }),
});
