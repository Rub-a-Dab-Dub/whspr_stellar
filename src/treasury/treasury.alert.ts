export class TreasuryAlert {
  constructor(private threshold: bigint) {}

  checkBalance(balance: bigint) {
    if (balance < this.threshold) {
      return { alert: true, message: "Treasury wallet balance below threshold!" };
    }
    return { alert: false };
  }
}
