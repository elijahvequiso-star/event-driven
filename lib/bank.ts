export type BankTransactionType = 'credit' | 'debit';

export type BankTransaction = {
  id: string;
  label: string;
  category: string;
  amount: number;
  type: BankTransactionType;
  timestamp: string;
};

export type BankState = {
  balance: number;
  transactions: BankTransaction[];
};

export const STORAGE_KEY = 'finding-your-ways-bank';

export const defaultTransactions: BankTransaction[] = [
  {
    id: 'txn-1',
    label: 'Monthly payroll',
    category: 'Income',
    amount: 3250.75,
    type: 'credit',
    timestamp: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'txn-2',
    label: 'The Green Table',
    category: 'Dining',
    amount: 64.2,
    type: 'debit',
    timestamp: '2026-10-05T18:30:00.000Z',
  },
  {
    id: 'txn-3',
    label: 'City Transit',
    category: 'Travel',
    amount: 28.5,
    type: 'debit',
    timestamp: '2026-10-10T08:15:00.000Z',
  },
  {
    id: 'txn-4',
    label: 'Freelance invoice',
    category: 'Income',
    amount: 480.0,
    type: 'credit',
    timestamp: '2026-10-18T14:00:00.000Z',
  },
];

export const defaultBankState: BankState = {
  balance: 4285.69,
  transactions: defaultTransactions,
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function readBankState(): BankState {
  if (typeof window === 'undefined') {
    return defaultBankState;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultBankState;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BankState>;
    if (typeof parsed.balance === 'number' && Array.isArray(parsed.transactions)) {
      return {
        balance: parsed.balance,
        transactions: parsed.transactions,
      };
    }
  } catch {
    // fall through to default state
  }

  return defaultBankState;
}

export function persistBankState(nextState: BankState) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

export function addBankTransaction(
  prevState: BankState,
  input: Pick<BankTransaction, 'label' | 'category' | 'amount' | 'type'>,
) {
  const nextTransaction: BankTransaction = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    ...input,
    timestamp: new Date().toISOString(),
  };

  const nextBalance =
    input.type === 'credit' ? prevState.balance + input.amount : prevState.balance - input.amount;

  const nextState: BankState = {
    balance: Number(nextBalance.toFixed(2)),
    transactions: [nextTransaction, ...prevState.transactions],
  };

  persistBankState(nextState);

  return nextState;
}
