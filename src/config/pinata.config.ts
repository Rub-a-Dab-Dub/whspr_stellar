import { registerAs } from '@nestjs/config';

export default registerAs('pinata', () => ({
  jwt: process.env.PINATA_JWT,
  gatewayUrl: process.env.PINATA_GATEWAY_URL,
}));
