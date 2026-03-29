import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('export-queue')
export class ReceiptsProcessor extends WorkerHost {
  async process(job: Job): Promise<any> {
    if (job.name === 'generate-csv') {
      // Mock data fetch of 10,000 transactions
      const transactions = Array.from({ length: 10000 }, (_, i) => ({
        id: i + 1,
        amount: Math.random() * 1000,
        date: new Date().toISOString(),
        description: `Transaction ${i + 1}`,
      }));

      console.log('Starting CSV generation for 10,000 transactions...');

      // Use json2csv to convert to CSV
      const { Parser } = require('json2csv');
      const parser = new Parser();
      const csv = parser.parse(transactions);

      console.log('CSV generation completed.');

      // Return the CSV string (or a mock S3 URL)
      return csv;
    }
  }
}
