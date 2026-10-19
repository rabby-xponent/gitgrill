/**
 * Bangladesh Mobile Financial Services (MFS) Payment Engine
 * Supports bKash and Nagad manual verification workflows.
 * Zero-overhead bootstrapping payment architecture for Bangladeshi developers.
 */

import fs from 'fs';
import path from 'path';
import { PlanId, PLANS } from '../config/plans';
import { writeSubscription } from './subscriptions';

export type MfsProvider = 'bkash' | 'nagad';
export type MfsPaymentStatus = 'pending_verification' | 'verified' | 'rejected';

export interface MfsPaymentRecord {
  id: string;
  userId: string;
  userHandle?: string;
  userEmail?: string;
  provider: MfsProvider;
  senderNumber: string;
  trxId: string;
  planId: PlanId;
  amountBdt: number;
  status: MfsPaymentStatus;
  submittedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  adminNotes?: string;
  graceUntil: string;
}

export interface MfsAccountDetail {
  number: string;
  type: 'personal' | 'merchant';
  note: string;
  isActive: boolean;
}

export interface MfsAccountConfig {
  bkash: MfsAccountDetail;
  nagad: MfsAccountDetail;
  noticeMessage?: string;
}

const CACHE_DIR = path.resolve(__dirname, '../../cache');
const PAYMENTS_FILE = path.join(CACHE_DIR, 'mfs-payments.json');
const CONFIG_FILE = path.join(CACHE_DIR, 'mfs-config.json');

export class MfsPaymentService {
  private payments: Map<string, MfsPaymentRecord> = new Map();
  private loaded: boolean = false;

  public accountsConfig: MfsAccountConfig = {
    bkash: {
      number: process.env.BKASH_ACCOUNT_NUMBER || '01711-000000',
      type: (process.env.BKASH_ACCOUNT_TYPE as any) || 'personal',
      note: 'Send Money (Personal) অথবা Payment (Merchant) অপশন ব্যবহার করুন। রেফারেন্সে আপনার গিটহাব ইউজারনেম দিন।',
      isActive: true,
    },
    nagad: {
      number: process.env.NAGAD_ACCOUNT_NUMBER || '01811-000000',
      type: (process.env.NAGAD_ACCOUNT_TYPE as any) || 'personal',
      note: 'Send Money অপশন ব্যবহার করুন। রেফারেন্সে আপনার গিটহাব হ্যান্ডেল দিন।',
      isActive: true,
    },
    noticeMessage: 'বিকাশ অথবা নগদ দিয়ে পেমেন্ট করার পর ট্রানজেকশন আইডি (TrxID) সাবমিট করুন। সাথে সাথেই তাৎক্ষণিক ২৪ ঘণ্টার প্রভিশনাল প্রো অ্যাক্সেস চালু হবে।',
  };

  constructor() {
    this.ensureLoaded();
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      if (fs.existsSync(PAYMENTS_FILE)) {
        const raw = fs.readFileSync(PAYMENTS_FILE, 'utf8');
        const list: MfsPaymentRecord[] = JSON.parse(raw);
        for (const item of list) {
          this.payments.set(item.id, item);
        }
      }
      if (fs.existsSync(CONFIG_FILE)) {
        const rawConfig = fs.readFileSync(CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(rawConfig);
        if (parsed.bkash) this.accountsConfig.bkash = { ...this.accountsConfig.bkash, ...parsed.bkash };
        if (parsed.nagad) this.accountsConfig.nagad = { ...this.accountsConfig.nagad, ...parsed.nagad };
        if (parsed.noticeMessage !== undefined) this.accountsConfig.noticeMessage = parsed.noticeMessage;
      }
    } catch (err) {
      console.error('[mfs-payment] Failed to load payments or config from disk:', err);
    }
    this.loaded = true;
  }

  private saveToDisk(): void {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      const list = Array.from(this.payments.values());
      fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      console.error('[mfs-payment] Failed to persist payments to disk:', err);
    }
  }

  public saveConfigToDisk(): void {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.accountsConfig, null, 2), 'utf8');
    } catch (err) {
      console.error('[mfs-payment] Failed to persist MFS config to disk:', err);
    }
  }

  public getAccountsConfig(): MfsAccountConfig {
    this.ensureLoaded();
    return this.accountsConfig;
  }

  public updateAccountsConfig(update: Partial<MfsAccountConfig>): MfsAccountConfig {
    this.ensureLoaded();
    if (update.bkash) {
      this.accountsConfig.bkash = { ...this.accountsConfig.bkash, ...update.bkash };
    }
    if (update.nagad) {
      this.accountsConfig.nagad = { ...this.accountsConfig.nagad, ...update.nagad };
    }
    if (update.noticeMessage !== undefined) {
      this.accountsConfig.noticeMessage = update.noticeMessage;
    }
    this.saveConfigToDisk();
    return this.accountsConfig;
  }

  /**
   * Submit a payment with bKash / Nagad transaction ID.
   * Grants 24-hour instant provisional access so user never has to wait.
   */
  async submitPayment(input: {
    userId: string;
    userHandle?: string;
    userEmail?: string;
    provider: MfsProvider;
    senderNumber: string;
    trxId: string;
    planId: PlanId;
  }): Promise<{ record: MfsPaymentRecord; instantAccessGranted: boolean }> {
    this.ensureLoaded();

    if (input.provider !== 'bkash' && input.provider !== 'nagad') {
      throw new Error('Unsupported MFS provider. Only bKash and Nagad are accepted.');
    }

    const plan = PLANS[input.planId];
    if (!plan) {
      throw new Error(`Invalid plan: ${input.planId}`);
    }

    // Format & validate clean phone
    const cleanPhone = input.senderNumber.replace(/[^\d+]/g, '');
    if (!/^(\+?88)?01[3-9]\d{8}$/.test(cleanPhone)) {
      throw new Error('দয়া করে সঠিক ১১ ডিজিটের বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 01712345678)');
    }

    // Validate TrxID
    const cleanTrxId = input.trxId.trim().toUpperCase();
    if (cleanTrxId.length < 6 || !/^[A-Z0-9]+$/.test(cleanTrxId)) {
      throw new Error('দয়া করে সঠিক Transaction ID (TrxID) দিন (যেমন: BJC7A98DF2)');
    }

    // Check duplicate TrxID
    for (const existing of this.payments.values()) {
      if (existing.trxId === cleanTrxId && existing.status !== 'rejected') {
        throw new Error('এই Transaction ID টি ইতিমধ্যে জমা দেওয়া হয়েছে। অনুগ্রহ করে যাচাই করার জন্য অপেক্ষা করুন।');
      }
    }

    const now = new Date();
    // 24-hour provisional access window
    const graceUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const paymentId = `mfs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record: MfsPaymentRecord = {
      id: paymentId,
      userId: input.userId,
      userHandle: input.userHandle,
      userEmail: input.userEmail,
      provider: input.provider,
      senderNumber: cleanPhone,
      trxId: cleanTrxId,
      planId: input.planId,
      amountBdt: plan.bdtAmount,
      status: 'pending_verification',
      submittedAt: now.toISOString(),
      graceUntil,
    };

    this.payments.set(paymentId, record);
    this.saveToDisk();

    // Activate provisional instant access in subscriptions mirror
    try {
      await writeSubscription({
        userId: input.userId,
        customerId: `mfs_${cleanPhone}`,
        subscriptionId: paymentId,
        plan: input.planId,
        status: 'active', // provisional active
        seats: plan.perSeat ? 1 : 1,
        currentPeriodEnd: graceUntil,
        cancelAtPeriodEnd: false,
        graceUntil: graceUntil,
      });
    } catch (subErr) {
      console.warn('[mfs-payment] Failed to write provisional subscription:', subErr);
    }

    return { record, instantAccessGranted: true };
  }

  /**
   * Get latest payment record and subscription status for user.
   */
  async getUserPaymentStatus(userId: string): Promise<{
    hasPending: boolean;
    latestRecord: MfsPaymentRecord | null;
    accounts: MfsAccountConfig;
  }> {
    this.ensureLoaded();
    const userPayments = Array.from(this.payments.values())
      .filter((p) => p.userId === userId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    const latest = userPayments[0] || null;
    const hasPending = latest?.status === 'pending_verification';

    return {
      hasPending,
      latestRecord: latest,
      accounts: this.accountsConfig,
    };
  }

  /**
   * Admin: List all submissions with optional filter.
   */
  async listPayments(filter?: { status?: MfsPaymentStatus; userId?: string }): Promise<MfsPaymentRecord[]> {
    this.ensureLoaded();
    let items = Array.from(this.payments.values());

    if (filter?.status) {
      items = items.filter((p) => p.status === filter.status);
    }
    if (filter?.userId) {
      items = items.filter((p) => p.userId === filter.userId);
    }

    return items.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  /**
   * Admin: Verify and approve or reject a payment.
   */
  async verifyPayment(
    paymentId: string,
    action: 'approve' | 'reject',
    adminUser: string = 'admin',
    notes?: string
  ): Promise<MfsPaymentRecord> {
    this.ensureLoaded();
    const record = this.payments.get(paymentId);
    if (!record) {
      throw new Error(`Payment record not found: ${paymentId}`);
    }

    const plan = PLANS[record.planId];
    const now = new Date();

    if (action === 'approve') {
      record.status = 'verified';
      record.verifiedAt = now.toISOString();
      record.verifiedBy = adminUser;
      if (notes) record.adminNotes = notes;

      // Extend to full period: 30 days for monthly, 365 for annual
      const days = record.planId.includes('annual') ? 365 : 30;
      const periodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

      await writeSubscription({
        userId: record.userId,
        customerId: `mfs_${record.senderNumber}`,
        subscriptionId: record.id,
        plan: record.planId,
        status: 'active',
        seats: plan?.perSeat ? 1 : 1,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        graceUntil: null,
      });
    } else {
      record.status = 'rejected';
      record.rejectionReason = notes || 'Payment verification failed or TrxID invalid.';

      // Revoke provisional access
      await writeSubscription({
        userId: record.userId,
        customerId: null,
        subscriptionId: null,
        plan: null,
        status: 'none',
        seats: 1,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        graceUntil: null,
      });
    }

    this.saveToDisk();
    return record;
  }
}

export const mfsPaymentService = new MfsPaymentService();
