import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { GeoService } from './geo.service';
import { CacheService } from '../cache/cache.service';

describe('GeoService', () => {
  let service: GeoService;
  let http: jest.Mocked<HttpService>;
  let cache: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    http = { get: jest.fn() } as unknown as jest.Mocked<HttpService>;
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoService,
        { provide: HttpService, useValue: http },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get(GeoService);
  });

  it('returns cached result without calling API', async () => {
    const cached = { country: 'US', countryCode: 'US', city: 'NY', isProxy: false, isTor: false, isp: null };
    cache.get.mockResolvedValue(cached);
    const result = await service.lookup('1.2.3.4');
    expect(result).toEqual(cached);
    expect(http.get).not.toHaveBeenCalled();
  });

  it('calls ip-api and caches result on miss', async () => {
    http.get.mockReturnValue(
      of({
        data: {
          status: 'success',
          country: 'Germany',
          countryCode: 'DE',
          city: 'Berlin',
          proxy: false,
          hosting: false,
          isp: 'Deutsche Telekom',
        },
      } as any),
    );
    const result = await service.lookup('5.6.7.8');
    expect(result.country).toBe('Germany');
    expect(result.isProxy).toBe(false);
    expect(cache.set).toHaveBeenCalledWith('geo:5.6.7.8', expect.any(Object), 3600);
  });

  it('marks isProxy true when hosting=true', async () => {
    http.get.mockReturnValue(
      of({ data: { status: 'success', country: 'US', countryCode: 'US', city: 'LA', proxy: false, hosting: true, isp: 'AWS' } } as any),
    );
    const result = await service.lookup('3.3.3.3');
    expect(result.isProxy).toBe(true);
  });

  it('returns unknown geo on API failure', async () => {
    http.get.mockReturnValue(throwError(() => new Error('network error')));
    const result = await service.lookup('0.0.0.0');
    expect(result.country).toBeNull();
    expect(result.isProxy).toBe(false);
  });

  it('returns unknown geo when status != success', async () => {
    http.get.mockReturnValue(of({ data: { status: 'fail' } } as any));
    const result = await service.lookup('0.0.0.1');
    expect(result.country).toBeNull();
  });
});
