import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'Gasless Gossip API',
      version: '1.0.0',
      description: 'Backend API for Gasless Gossip',
      docs: '/api/docs',
    };
  }
}
