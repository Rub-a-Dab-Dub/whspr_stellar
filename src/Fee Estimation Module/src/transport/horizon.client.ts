import axios from 'axios';

export class HorizonClient {
  baseUrl = 'https://horizon.stellar.org';

  async getFeeStats(): Promise<{fee_charged: {p10: string, p50: string, p90: string}, base_fee: string}> {
    const res = await axios.get(this.baseUrl + '/fee_stats');
    return res.data;
  }
}
